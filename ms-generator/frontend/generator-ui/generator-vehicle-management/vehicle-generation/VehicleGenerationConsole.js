import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { FusePageCarded } from '@fuse';
import { Card, Button, Typography, Chip, Box } from '@material-ui/core';
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

  const lastRenderTimeRef = useRef(Date.now());
  const vehiclesRef = useRef([]);

  const [startGeneration] = useMutation(GeneratorStartGeneration);
  const [stopGeneration] = useMutation(GeneratorStopGeneration);
  const { data: statusData } = useQuery(GeneratorGenerationStatus, { pollInterval: 1000 });
  const { data: subscriptionData, loading: subscriptionLoading, error: subscriptionError } = useSubscription(onGeneratorVehicleGenerated);

  // Debug subscription
  useEffect(() => {
    console.log('📡 Subscription status:', { subscriptionLoading, subscriptionError, subscriptionData });
    if (subscriptionError) {
      console.error('❌ Subscription error:', subscriptionError);
    }
  }, [subscriptionLoading, subscriptionError, subscriptionData]);

  const shouldRender = useCallback(() => {
    const now = Date.now();
    if (now - lastRenderTimeRef.current >= 1000) {
      lastRenderTimeRef.current = now;
      return true;
    }
    return false;
  }, []);

  // Memoized VehicleRow component to prevent unnecessary re-renders
  const VehicleRow = memo(({ index, style, vehicles }) => {
    const vehicle = vehicles[index];
    if (!vehicle) return null;
    return (
      <div style={style} className="flex items-center border-b border-gray-200 px-4 py-2 hover:bg-gray-50">
        <div className="flex-1 text-sm font-medium">{vehicle.year}</div>
        <div className="flex-1 text-sm">{vehicle.type}</div>
        <div className="flex-1 text-sm">{vehicle.hp}</div>
        <div className="flex-1 text-sm">{vehicle.topSpeed}</div>
        <div className="flex-1 text-sm">
          <Chip 
            label={vehicle.powerSource} 
            size="small" 
            color={vehicle.powerSource === 'Electric' ? 'primary' : 'default'}
          />
        </div>
        <div className="flex-1 text-xs text-gray-500 font-mono">{vehicle.id ? vehicle.id.substring(0, 8) + '...' : ''}</div>
      </div>
    );
  });

  // Memoized VirtualizedList component to control re-renders
  const VirtualizedList = memo(({ vehicles }) => {
    console.log('🔄 VirtualizedList re-rendered at:', new Date().toISOString(), 'with', vehicles.length, 'vehicles');
    
    if (vehicles.length === 0) {
      return (
        <div className="flex items-center justify-center h-96 text-gray-500">
          <Typography variant="body1">No hay vehículos generados aún. Haz clic en "Iniciar Simulación" para comenzar.</Typography>
        </div>
      );
    }

    return (
      <List height={400} itemCount={vehicles.length} itemSize={42} width={'100%'}>
        {({ index, style }) => <VehicleRow index={index} style={style} vehicles={vehicles} />}
      </List>
    );
  });

  const handleStartGeneration = async () => {
    await startGeneration();
    setIsGenerating(true);
    setGeneratedCount(0);
    setVehicles([]);
  };

  const handleStopGeneration = async () => {
    await stopGeneration();
    setIsGenerating(false);
  };

  useEffect(() => {
    if (statusData && statusData.GeneratorGenerationStatus) {
      setIsGenerating(statusData.GeneratorGenerationStatus.isGenerating);
      setGeneratedCount(statusData.GeneratorGenerationStatus.generatedCount);
    }
  }, [statusData]);

  useEffect(() => {
    if (subscriptionData && subscriptionData.GeneratorVehicleGenerated) {
      const evt = subscriptionData.GeneratorVehicleGenerated;
      console.log('🔔 Frontend received subscription data:', evt);
      const vehicleData = evt.data;
      
      // Always update the counter (
      setGeneratedCount(evt.generatedCount || 0);

      // Create the new vehicle object
      const newVehicle = {
        id: evt.aid,
        year: vehicleData.year,
        type: vehicleData.type,
        hp: vehicleData.hp,
        topSpeed: vehicleData.topSpeed,
        powerSource: vehicleData.powerSource,
        timestamp: evt.timestamp
      };

      console.log('🚗 New vehicle created:', newVehicle);

      // Update vehicles state directly - remove throttling for now to debug
      setVehicles(prev => {
        const updated = [newVehicle, ...prev].slice(0, 1000);
        console.log('📊 Updated vehicles array length:', updated.length);
        return updated;
      });
    }
  }, [subscriptionData]);

  return (
    <FusePageCarded
      header={
        <div className="p-24">
          <Typography variant="h6">Generador de Flota Vehicular</Typography>
          <Box display="flex" alignItems="center" mt={1}>
            <Button color="primary" variant="contained" onClick={handleStartGeneration} style={{ marginRight: 8 }}>Iniciar Simulación</Button>
            <Button color="secondary" variant="outlined" onClick={handleStopGeneration}>Detener Simulación</Button>
            <Chip label={isGenerating ? 'Corriendo...' : 'Detenido'} style={{ marginLeft: 12 }} />
            <Chip label={`Vehículos Generados: ${generatedCount}`} style={{ marginLeft: 12 }} />
          </Box>
        </div>
      }
      content={
        <Card className="m-24 p-16">
          <Typography variant="subtitle1" className="mb-12">Vehículos Generados en Tiempo Real</Typography>
          
          {/* Table Header */}
          <div className="flex items-center border-b-2 border-gray-300 px-4 py-3 bg-gray-50 font-semibold">
            <div className="flex-1 text-sm">Año</div>
            <div className="flex-1 text-sm">Tipo</div>
            <div className="flex-1 text-sm">Potencia (HP)</div>
            <div className="flex-1 text-sm">Vel. Máxima (km/h)</div>
            <div className="flex-1 text-sm">Power Source</div>
            <div className="flex-1 text-sm">ID</div>
          </div>
          
          {/* Virtualized List - Memoized to control re-renders */}
          <VirtualizedList vehicles={vehicles} />
        </Card>
      }
    />
  );
}

export default VehicleGenerationConsole;


