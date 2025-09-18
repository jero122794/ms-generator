import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FusePageCarded } from '@fuse';
import { Card, Button, Typography, Chip, Icon, Box } from '@material-ui/core';
import { useMutation, useQuery, useSubscription } from '@apollo/react-hooks';
import { FixedSizeList as List } from 'react-window';
import {
  GeneratorStartGeneration,
  GeneratorStopGeneration,
  GeneratorGenerationStatus,
  onGeneratorVehicleGenerated
} from '../gql/VehicleGeneration';

function VehicleGenerationConsole() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [vehicles, setVehicles] = useState([]);

  // Performance optimization refs
  const lastRenderTimeRef = useRef(Date.now());
  const vehiclesRef = useRef([]);
  const shouldRenderRef = useRef(true);

  // GraphQL hooks
  const [startGeneration] = useMutation(GeneratorStartGeneration);
  const [stopGeneration] = useMutation(GeneratorStopGeneration);
  const { data: statusData } = useQuery(GeneratorGenerationStatus, { 
    pollInterval: 1000 
  });
  const { data: subscriptionData } = useSubscription(onGeneratorVehicleGenerated);

  // Throttling render to max once per second
  const shouldRender = useCallback(() => {
    const now = Date.now();
    if (now - lastRenderTimeRef.current >= 1000) {
      lastRenderTimeRef.current = now;
      return true;
    }
    return false;
  }, []);

  // Handle start generation
  const handleStartGeneration = async () => {
    try {
      await startGeneration();
      setIsGenerating(true);
      setGeneratedCount(0);
      setVehicles([]); // Clear previous vehicles
    } catch (error) {
      console.error('Error starting generation:', error);
    }
  };

  // Handle stop generation
  const handleStopGeneration = async () => {
    try {
      await stopGeneration();
      setIsGenerating(false);
    } catch (error) {
      console.error('Error stopping generation:', error);
    }
  };

  // Update status from backend
  useEffect(() => {
    if (statusData && statusData.GeneratorGenerationStatus) {
      setIsGenerating(statusData.GeneratorGenerationStatus.isGenerating);
      setGeneratedCount(statusData.GeneratorGenerationStatus.generatedCount);
    }
  }, [statusData]);

  // Handle new vehicle from WebSocket/Subscription
  useEffect(() => {
    if (subscriptionData && subscriptionData.GeneratorVehicleGenerated) {
      const newVehicle = subscriptionData.GeneratorVehicleGenerated.data;
      setGeneratedCount(subscriptionData.GeneratorVehicleGenerated.generatedCount);

      // Only update vehicles list if should render (throttling)
      if (shouldRender()) {
        setVehicles(prev => {
          const updated = [{ ...newVehicle, id: newVehicle.aid }, ...prev].slice(0, 1000);
          vehiclesRef.current = updated;
          return updated;
        });
      } else {
        // Update ref without triggering re-render
        setVehicles(prev => {
          const updated = [{ ...newVehicle, id: newVehicle.aid }, ...prev].slice(0, 1000);
          vehiclesRef.current = updated;
          return prev; // Don't trigger re-render
        });
      }
    }
  }, [subscriptionData, shouldRender]);

  // Virtualized Row Component
  const VehicleRow = ({ index, style }) => {
    const vehicle = vehiclesRef.current[index];
    if (!vehicle) return null;

    return (
      <div style={style} className="flex items-center border-b border-gray-200 px-4 py-2">
        <div className="flex-1 text-sm">{vehicle.data.year}</div>
        <div className="flex-1 text-sm">{vehicle.data.type}</div>
        <div className="flex-1 text-sm">{vehicle.data.hp} HP</div>
        <div className="flex-1 text-sm">{vehicle.data.topSpeed} km/h</div>
        <div className="flex-1 text-sm">
          <Chip 
            label={vehicle.data.powerSource} 
            size="small" 
            color={vehicle.data.powerSource === 'Electric' ? 'primary' : 
                   vehicle.data.powerSource === 'Hybrid' ? 'secondary' : 'default'}
          />
        </div>
        <div className="flex-1 text-xs text-gray-500">
          {vehicle.aid.substring(0, 8)}...
        </div>
      </div>
    );
  };

  return (
    <FusePageCarded
      header={
        <div className="flex flex-col sm:flex-row space-y-16 sm:space-y-0 flex-1 w-full items-center justify-between py-32 px-24 md:px-32">
          <Typography
            component={Box}
            variant="h4"
            className="flex items-center sm:mb-0"
          >
            <Icon className="text-32 mr-12">directions_car</Icon>
            Generador de Flota Vehicular
          </Typography>
          
          <div className="flex items-center space-x-16">
            <div className="flex items-center space-x-8">
              <Chip
                icon={<Icon>{isGenerating ? 'play_arrow' : 'pause'}</Icon>}
                label={isGenerating ? 'Corriendo...' : 'Detenido'}
                color={isGenerating ? 'primary' : 'default'}
                variant="outlined"
              />
              <Typography variant="body1">
                Vehículos Generados: <strong>{generatedCount}</strong>
              </Typography>
            </div>
            
            <div className="flex space-x-8">
              <Button
                variant="contained"
                color="primary"
                onClick={handleStartGeneration}
                disabled={isGenerating}
                startIcon={<Icon>play_arrow</Icon>}
              >
                Iniciar Simulación
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleStopGeneration}
                disabled={!isGenerating}
                startIcon={<Icon>stop</Icon>}
              >
                Detener Simulación
              </Button>
            </div>
          </div>
        </div>
      }
      content={
        <div className="p-24">
          <Card className="w-full">
            <div className="p-24">
              <Typography variant="h6" className="mb-16">
                Vehículos Generados en Tiempo Real
              </Typography>
              
              {/* Table Header */}
              <div className="flex items-center border-b-2 border-gray-300 px-4 py-3 font-semibold text-gray-700">
                <div className="flex-1">Año</div>
                <div className="flex-1">Tipo</div>
                <div className="flex-1">Potencia (HP)</div>
                <div className="flex-1">Vel. Máxima (km/h)</div>
                <div className="flex-1">Power Source</div>
                <div className="flex-1">AID</div>
              </div>
              
              {/* Virtualized List */}
              <div className="border border-gray-200 rounded">
                {vehiclesRef.current.length > 0 ? (
                  <List
                    height={400}
                    itemCount={vehiclesRef.current.length}
                    itemSize={50}
                    width="100%"
                  >
                    {VehicleRow}
                  </List>
                ) : (
                  <div className="flex items-center justify-center h-96 text-gray-500">
                    <Typography variant="body1">
                      {isGenerating ? 'Generando vehículos...' : 'Presiona "Iniciar Simulación" para comenzar'}
                    </Typography>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </div>
      }
    />
  );
}

export default VehicleGenerationConsole;
