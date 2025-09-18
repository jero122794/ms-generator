import { gql } from 'apollo-boost';

// Mutation to start vehicle generation
export const GeneratorStartGeneration = gql`
  mutation GeneratorStartGeneration {
    GeneratorStartGeneration {
      code
      message
    }
  }
`;

// Mutation to stop vehicle generation
export const GeneratorStopGeneration = gql`
  mutation GeneratorStopGeneration {
    GeneratorStopGeneration {
      code
      message
    }
  }
`;

// Query to get generation status
export const GeneratorGenerationStatus = gql`
  query GeneratorGenerationStatus {
    GeneratorGenerationStatus {
      isGenerating
      generatedCount
      status
    }
  }
`;

// Subscription for real-time vehicle generation events
export const onGeneratorVehicleGenerated = gql`
  subscription onGeneratorVehicleGenerated {
    GeneratorVehicleGenerated {
      at
      et
      aid
      timestamp
      generatedCount
      data {
        type
        powerSource
        hp
        year
        topSpeed
      }
    }
  }
`;
