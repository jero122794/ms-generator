"use strict";

const uuidv4 = require("uuid/v4");
const { of, forkJoin, from, iif, throwError, interval, Subject } = require("rxjs");
const { mergeMap, catchError, map, toArray, pluck, takeUntil, tap } = require('rxjs/operators');
const crypto = require('crypto');

const Event = require("@nebulae/event-store").Event;
const { CqrsResponseHelper } = require('@nebulae/backend-node-tools').cqrs;
const { ConsoleLogger } = require('@nebulae/backend-node-tools').log;
const { CustomError, INTERNAL_SERVER_ERROR_CODE, PERMISSION_DENIED } = require("@nebulae/backend-node-tools").error;
const { brokerFactory } = require("@nebulae/backend-node-tools").broker;

const broker = brokerFactory();
const eventSourcing = require("../../tools/event-sourcing").eventSourcing;
const VehicleDA = require("./data-access/VehicleDA");

const READ_ROLES = ["VEHICLE_READ"];
const WRITE_ROLES = ["VEHICLE_WRITE"];
const REQUIRED_ATTRIBUTES = [];
const MATERIALIZED_VIEW_TOPIC = "generator-ui-gateway-materialized-view-updates";
const VEHICLE_GENERATION_TOPIC = "fleet/vehicles/generated";
const WEBSOCKET_TOPIC = "generator-ui-gateway-websocket-updates";

/**
 * Singleton instance
 * @type { VehicleCRUD }
 */
let instance;

class VehicleCRUD {
  constructor() {
    this.isGenerating = false;
    this.generatedCount = 0;
    this.generationSubject = null;
  }

  generateRequestProcessorMap() {
    return {
      'Vehicle': {
        "generator-uigateway.graphql.query.GeneratorVehicleListing": { fn: instance.getGeneratorVehicleListing$, instance, jwtValidation: { roles: READ_ROLES, attributes: REQUIRED_ATTRIBUTES } },
        "generator-uigateway.graphql.query.GeneratorVehicle": { fn: instance.getVehicle$, instance, jwtValidation: { roles: READ_ROLES, attributes: REQUIRED_ATTRIBUTES } },
        "generator-uigateway.graphql.query.GeneratorGenerationStatus": { fn: instance.getGenerationStatus$, instance, jwtValidation: { roles: READ_ROLES, attributes: REQUIRED_ATTRIBUTES } },
        "generator-uigateway.graphql.mutation.GeneratorCreateVehicle": { fn: instance.createVehicle$, instance, jwtValidation: { roles: WRITE_ROLES, attributes: REQUIRED_ATTRIBUTES } },
        "generator-uigateway.graphql.mutation.GeneratorUpdateVehicle": { fn: instance.updateVehicle$, jwtValidation: { roles: WRITE_ROLES, attributes: REQUIRED_ATTRIBUTES } },
        "generator-uigateway.graphql.mutation.GeneratorDeleteVehicles": { fn: instance.deleteVehicles$, jwtValidation: { roles: WRITE_ROLES, attributes: REQUIRED_ATTRIBUTES } },
        "generator-uigateway.graphql.mutation.GeneratorStartGeneration": { fn: instance.startGeneration$, instance, jwtValidation: { roles: WRITE_ROLES, attributes: REQUIRED_ATTRIBUTES } },
        "generator-uigateway.graphql.mutation.GeneratorStopGeneration": { fn: instance.stopGeneration$, instance, jwtValidation: { roles: WRITE_ROLES, attributes: REQUIRED_ATTRIBUTES } },
      }
    }
  };


  /**  
   * Gets the Vehicle list
   *
   * @param {*} args args
   */
  getGeneratorVehicleListing$({ args }, authToken) {
    const { filterInput, paginationInput, sortInput } = args;
    const { queryTotalResultCount = false } = paginationInput || {};

    return forkJoin(
      VehicleDA.getVehicleList$(filterInput, paginationInput, sortInput).pipe(toArray()),
      queryTotalResultCount ? VehicleDA.getVehicleSize$(filterInput) : of(undefined),
    ).pipe(
      map(([listing, queryTotalResultCount]) => ({ listing, queryTotalResultCount })),
      mergeMap(rawResponse => CqrsResponseHelper.buildSuccessResponse$(rawResponse)),
      catchError(err => iif(() => err.name === 'MongoTimeoutError', throwError(err), CqrsResponseHelper.handleError$(err)))
    );
  }

  /**  
   * 
   *
   * @param {*} args args
   */
  getVehicle$({ args }, authToken) {
    const { id, organizationId } = args;
    return VehicleDA.getVehicle$(id, organizationId).pipe(
      mergeMap(rawResponse => CqrsResponseHelper.buildSuccessResponse$(rawResponse)),
      catchError(err => iif(() => err.name === 'MongoTimeoutError', throwError(err), CqrsResponseHelper.handleError$(err)))
    );

  }



  createVehicle$({ root, args, jwt }, authToken) {
    const aggregateId = uuidv4();
    const input = {
      active: false,
      ...args.input,
    };

    return VehicleDA.createVehicle$(aggregateId, input, authToken.preferred_username).pipe(
      mergeMap(aggregate => forkJoin(
        CqrsResponseHelper.buildSuccessResponse$(aggregate),
        eventSourcing.generator-uitEvent$(instance.buildAggregateMofifiedEvent('CREATE', 'Vehicle', aggregateId, authToken, aggregate), { autoAcknowledgeKey: process.env.MICROBACKEND_KEY }),
        broker.send$(MATERIALIZED_VIEW_TOPIC, `GeneratorVehicleModified`, aggregate)
      )),
      map(([sucessResponse]) => sucessResponse),
      catchError(err => iif(() => err.name === 'MongoTimeoutError', throwError(err), CqrsResponseHelper.handleError$(err)))
    )
  }

  updateVehicle$({ root, args, jwt }, authToken) {
    const { id, input, merge } = args;

    return (merge ? VehicleDA.updateVehicle$ : VehicleDA.replaceVehicle$)(id, input, authToken.preferred_username).pipe(
      mergeMap(aggregate => forkJoin(
        CqrsResponseHelper.buildSuccessResponse$(aggregate),
        eventSourcing.generator-uitEvent$(instance.buildAggregateMofifiedEvent(merge ? 'UPDATE_MERGE' : 'UPDATE_REPLACE', 'Vehicle', id, authToken, aggregate), { autoAcknowledgeKey: process.env.MICROBACKEND_KEY }),
        broker.send$(MATERIALIZED_VIEW_TOPIC, `GeneratorVehicleModified`, aggregate)
      )),
      map(([sucessResponse]) => sucessResponse),
      catchError(err => iif(() => err.name === 'MongoTimeoutError', throwError(err), CqrsResponseHelper.handleError$(err)))
    )
  }


  deleteVehicles$({ root, args, jwt }, authToken) {
    const { ids } = args;
    return forkJoin(
      VehicleDA.deleteVehicles$(ids),
      from(ids).pipe(
        mergeMap(id => eventSourcing.generator-uitEvent$(instance.buildAggregateMofifiedEvent('DELETE', 'Vehicle', id, authToken, {}), { autoAcknowledgeKey: process.env.MICROBACKEND_KEY })),
        toArray()
      )
    ).pipe(
      map(([ok, esResps]) => ({ code: ok ? 200 : 400, message: `Vehicle with id:s ${JSON.stringify(ids)} ${ok ? "has been deleted" : "not found for deletion"}` })),
      mergeMap((r) => forkJoin(
        CqrsResponseHelper.buildSuccessResponse$(r),
        broker.send$(MATERIALIZED_VIEW_TOPIC, `GeneratorVehicleModified`, { id: 'deleted', name: '', active: false, description: '' })
      )),
      map(([cqrsResponse, brokerRes]) => cqrsResponse),
      catchError(err => iif(() => err.name === 'MongoTimeoutError', throwError(err), CqrsResponseHelper.handleError$(err)))
    );
  }

  startGeneration$({ root, args, jwt }, authToken) {
    if (this.isGenerating) {
      return of({ code: 400, message: "Vehicle generation is already running" }).pipe(
        mergeMap(response => CqrsResponseHelper.buildSuccessResponse$(response))
      );
    }

    ConsoleLogger.i("Starting vehicle generation...");
    this.isGenerating = true;
    this.generatedCount = 0;
    
    const stopSubject = new Subject();
    this.generationSubject = stopSubject;

    interval(50).pipe(
      takeUntil(stopSubject),
      tap(() => {
        const vehicleData = this.generateRandomVehicle();
        this.generatedCount++;
        this.publishVehicleGeneratedEvent(vehicleData);
      })
    ).subscribe();

    return of({ code: 200, message: "Vehicle generation started" }).pipe(
      mergeMap(response => CqrsResponseHelper.buildSuccessResponse$(response))
    );
  }

  stopGeneration$({ root, args, jwt }, authToken) {
    if (!this.isGenerating) {
      return of({ code: 400, message: "Vehicle generation is not running" }).pipe(
        mergeMap(response => CqrsResponseHelper.buildSuccessResponse$(response))
      );
    }

    ConsoleLogger.i("Stopping vehicle generation...");
    this.isGenerating = false;
    
    if (this.generationSubject) {
      this.generationSubject.next();
      this.generationSubject.complete();
      this.generationSubject = null;
    }

    return of({ code: 200, message: "Vehicle generation stopped" }).pipe(
      mergeMap(response => CqrsResponseHelper.buildSuccessResponse$(response))
    );
  }

  
  getGenerationStatus$({ root, args, jwt }, authToken) {
    return of({
      isGenerating: this.isGenerating,
      generatedCount: this.generatedCount,
      status: this.isGenerating ? "Running" : "Stopped"
    }).pipe(
      mergeMap(response => CqrsResponseHelper.buildSuccessResponse$(response))
    );
  }


  generateRandomVehicle() {
    const types = ['SUV', 'PickUp', 'Sedan', 'Hatchback', 'Coupe'];
    const powerSources = ['Electric', 'Gas', 'Hybrid', 'Diesel'];
    
    return {
      type: types[Math.floor(Math.random() * types.length)],
      powerSource: powerSources[Math.floor(Math.random() * powerSources.length)],
      hp: Math.floor(Math.random() * 225) + 75, // 75-300 HP
      year: Math.floor(Math.random() * 45) + 1980, // 1980-2024
      topSpeed: Math.floor(Math.random() * 200) + 100 // 100-300 km/h
    };
  }

  canonicalVehicle(data) {
    return {
      type: data.type,
      powerSource: data.powerSource,
      hp: data.hp,
      year: data.year,
      topSpeed: data.topSpeed
    };
  }


  makeAid(data) {
    const canonical = this.canonicalVehicle(data);
    const str = JSON.stringify(canonical);
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  publishVehicleGeneratedEvent(data) {
    const aid = this.makeAid(data);
    const msg = {
      at: 'Vehicle',
      et: 'Generated',
      aid: aid,
      timestamp: new Date().toISOString(),
      data: data
    };


    
    broker.send$(VEHICLE_GENERATION_TOPIC, 'VehicleGenerated', msg).subscribe();
    


   
    broker.send$(VEHICLE_GENERATION_TOPIC, 'VehicleGenerated', msg).subscribe();
    
   

    const websocketMsg = {
      type: 'VehicleGenerated',
      data: msg,
      generatedCount: this.generatedCount
    };
    
    console.log('📤 Backend sending WebSocket message:', websocketMsg);
    broker.send$(WEBSOCKET_TOPIC, 'VehicleGenerated', websocketMsg).subscribe();

    ConsoleLogger.i(`🚗 Vehicle generated: ${aid.substring(0, 8)}... - Total: ${this.generatedCount}`);
  }

  /**
   * 
   * @param {string} modType 'CREATE' | 'UPDATE' | 'DELETE'
   * @param {*} aggregateType 
   * @param {*} aggregateId 
   * @param {*} authToken 
   * @param {*} data 
   * @returns {Event}
   */
  buildAggregateMofifiedEvent(modType, aggregateType, aggregateId, authToken, data) {
    return new Event({
      eventType: `${aggregateType}Modified`,
      eventTypeVersion: 1,
      aggregateType: aggregateType,
      aggregateId,
      data: {
        modType,
        ...data
      },
      user: authToken.preferred_username
    })
  }
}

/**
 * @returns {VehicleCRUD}
 */
module.exports = () => {
  if (!instance) {
    instance = new VehicleCRUD();
    ConsoleLogger.i(`${instance.constructor.name} Singleton created`);
  }
  return instance;
};
