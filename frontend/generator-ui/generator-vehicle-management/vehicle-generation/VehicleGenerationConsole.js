import React, { useState, useEffect, useRef, memo } from 'react';
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

// Memoized VehicleRow component to prevent unnecessary re-renders
const VehicleRow = memo(({ index, style, data }) => {
  const vehicle = data[index];
  console.log(`🔍 VehicleRow ${index}:`, vehicle ? 'Vehicle exists' : 'No vehicle');
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

function VehicleGenerationConsole() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  
  const vehiclesBufferRef = useRef([]);

  const [startGeneration] = useMutation(GeneratorStartGeneration);
  const [stopGeneration] = useMutation(GeneratorStopGeneration);
  const { data: statusData } = useQuery(GeneratorGenerationStatus, { pollInterval: 1000 });
  // Temporarily disable subscription and use polling instead
  // const { data: subscriptionData, loading: subscriptionLoading, error: subscriptionError } = useSubscription(onGeneratorVehicleGenerated, {
  //   onSubscriptionData: ({ subscriptionData }) => {
  //     console.log('🎯 onSubscriptionData called:', subscriptionData);
  //   },
  //   onSubscriptionComplete: () => {
  //     console.log('✅ Subscription completed');
  //   },
  //   onError: (error) => {
  //     console.error('❌ Subscription error:', error);
  //   }
  // });
  
  // Use polling to get vehicle data
  const { data: subscriptionData, loading: subscriptionLoading, error: subscriptionError } = useQuery(GeneratorGenerationStatus, { 
    pollInterval: 100, // Poll every 100ms for real-time updates
    fetchPolicy: 'cache-and-network'
  });

  // Debug subscription
  useEffect(() => {
    console.log('📡 Subscription status:', { 
      subscriptionLoading, 
      subscriptionError, 
      hasData: !!subscriptionData,
      dataKeys: subscriptionData ? Object.keys(subscriptionData) : []
    });
    if (subscriptionError) {
      console.error('❌ Subscription error:', subscriptionError);
    }
    if (subscriptionData) {
      console.log('📊 Full subscription data:', subscriptionData);
    }
  }, [subscriptionLoading, subscriptionError, subscriptionData]);

  const handleStartGeneration = async () => {
    await startGeneration();
    setIsGenerating(true);
    setGeneratedCount(0);
    setVehicles([]);
    vehiclesBufferRef.current = [];
  };

  const handleStopGeneration = async () => {
    await stopGeneration();
    setIsGenerating(false);
  };

  const handleTestData = () => {
    console.log('🧪 Adding test data...');
    const testVehicle = {
      id: 'test-' + Date.now(),
      year: 2023,
      type: 'Test Car',
      hp: 200,
      topSpeed: 180,
      powerSource: 'Electric',
      timestamp: new Date().toISOString()
    };
    
    setVehicles(prev => {
      const updated = [testVehicle, ...prev].slice(0, 1000);
      console.log('🧪 Test vehicles array length:', updated.length);
      return updated;
    });
  };

  useEffect(() => {
    if (statusData && statusData.GeneratorGenerationStatus) {
      setIsGenerating(statusData.GeneratorGenerationStatus.isGenerating);
      setGeneratedCount(statusData.GeneratorGenerationStatus.generatedCount);
    }
  }, [statusData]);

  // Simulate vehicle data based on generation count
  useEffect(() => {
    if (isGenerating && generatedCount > 0) {
      // Generate a new vehicle every time the count increases
      const newVehicle = {
        id: `vehicle-${generatedCount}`,
        year: Math.floor(Math.random() * 45) + 1980,
        type: ['SUV', 'PickUp', 'Sedan', 'Hatchback', 'Coupe'][Math.floor(Math.random() * 5)],
        hp: Math.floor(Math.random() * 225) + 75,
        topSpeed: Math.floor(Math.random() * 200) + 100,
        powerSource: ['Electric', 'Gas', 'Hybrid', 'Diesel'][Math.floor(Math.random() * 4)],
        timestamp: new Date().toISOString()
      };
      
      console.log('🚗 Simulated new vehicle:', newVehicle);
      
      setVehicles(prev => {
        const updated = [newVehicle, ...prev].slice(0, 1000);
        console.log('✅ Updated vehicles array length:', updated.length);
        return updated;
      });
    }
  }, [generatedCount, isGenerating]);

  return (
    <FusePageCarded
      header={
        <div className="p-24">
          <Typography variant="h6">Generador de Flota Vehicular</Typography>
          <Box display="flex" alignItems="center" mt={1}>
            <Button color="primary" variant="contained" onClick={handleStartGeneration} style={{ marginRight: 8 }}>Iniciar Simulación</Button>
            <Button color="secondary" variant="outlined" onClick={handleStopGeneration} style={{ marginRight: 8 }}>Detener Simulación</Button>
            <Button color="default" variant="outlined" onClick={handleTestData} style={{ marginRight: 8 }}>🧪 Test Data</Button>
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
          
           {vehicles.length === 0 ? (
             <div className="flex items-center justify-center h-96 text-gray-500">
               <Typography variant="body1">
                 {isGenerating ? 'Generando vehículos...' : 'No hay vehículos generados aún. Haz clic en "Iniciar Simulación" para comenzar.'}
               </Typography>
             </div>
           ) : (
             <div>
               <div style={{ padding: '8px', fontSize: '12px', color: '#666' }}>
                 DEBUG: Vehicles array length: {vehicles.length}
               </div>
               <List height={400} itemCount={vehicles.length} itemSize={42} width={'100%'} itemData={vehicles}>
                 {VehicleRow}
               </List>
             </div>
           )}
        </Card>
      }
    />
  );
}

export default VehicleGenerationConsole;