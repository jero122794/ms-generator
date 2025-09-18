import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FusePageCarded } from '@fuse';
import { Card, Button, Typography, Chip, Icon, Box } from '@material-ui/core';
import { FixedSizeList as List } from 'react-window';

function VehicleGenerationSimple() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCount, setGeneratedCount] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [generationInterval, setGenerationInterval] = useState(null);

  // Performance optimization refs
  const lastRenderTimeRef = useRef(Date.now());
  const vehiclesRef = useRef([]);
  const shouldRenderRef = useRef(true);

  // SHA-256 hash function (same as backend) - using Web Crypto API
  const sha256 = useCallback(async (str) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }, []);

  const canonicalVehicle = useCallback((v) => {
    return `${v.type}|${v.powerSource}|${v.hp}|${v.year}|${v.topSpeed}`;
  }, []);

  const makeAid = useCallback(async (v) => {
    const canonical = canonicalVehicle(v);
    return await sha256(canonical);
  }, [sha256, canonicalVehicle]);

  // Throttling render to max once per second
  const shouldRender = useCallback(() => {
    const now = Date.now();
    if (now - lastRenderTimeRef.current >= 1000) {
      lastRenderTimeRef.current = now;
      return true;
    }
    return false;
  }, []);

  // Generate random vehicle data
  const generateRandomVehicle = useCallback(() => {
    const types = ['SUV', 'PickUp', 'Sedan'];
    const powerSources = ['Electric', 'Hybrid', 'Gas'];
    
    return {
      type: types[Math.floor(Math.random() * types.length)],
      powerSource: powerSources[Math.floor(Math.random() * powerSources.length)],
      hp: Math.floor(Math.random() * (300 - 75 + 1)) + 75,
      year: Math.floor(Math.random() * (2025 - 1980 + 1)) + 1980,
      topSpeed: Math.floor(Math.random() * (320 - 120 + 1)) + 120
    };
  }, []);

  // Handle start generation
  const handleStartGeneration = async () => {
    setIsGenerating(true);
    setGeneratedCount(0);
    setVehicles([]); // Clear previous vehicles

    // Start generation interval
    const interval = setInterval(async () => {
      const vehicleData = generateRandomVehicle();
      const aid = await makeAid(vehicleData);
      
      const newVehicle = {
        at: 'Vehicle',
        et: 'Generated',
        aid: aid,
        timestamp: new Date().toISOString(),
        data: vehicleData
      };

      setGeneratedCount(prev => prev + 1);

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
    }, 50); // 50ms interval

    setGenerationInterval(interval);
  };

  // Handle stop generation
  const handleStopGeneration = () => {
    setIsGenerating(false);
    if (generationInterval) {
      clearInterval(generationInterval);
      setGenerationInterval(null);
    }
  };

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
            <div className="flex items-center space-x-16">
              <Chip
                icon={<Icon>{isGenerating ? 'play_arrow' : 'pause'}</Icon>}
                label={isGenerating ? 'Corriendo...' : 'Detenido'}
                color={isGenerating ? 'primary' : 'default'}
                variant="outlined"
              />
              <Typography variant="body1" style={{ marginLeft: '16px' }}>
                Vehículos Generados: <strong>{generatedCount}</strong>
              </Typography>
            </div>
            
            <div className="flex space-x-16" style={{ marginLeft: '24px' }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleStartGeneration}
                disabled={isGenerating}
                startIcon={<Icon>play_arrow</Icon>}
                style={{ marginRight: '8px' }}
              >
                Iniciar Simulación
              </Button>
              <Button
                variant="contained"
                color="secondary"
                onClick={handleStopGeneration}
                disabled={!isGenerating}
                startIcon={<Icon>stop</Icon>}
                style={{ marginLeft: '8px' }}
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

export default VehicleGenerationSimple;
