import { gql } from 'apollo-boost';

export const GeneratorStartGeneration = gql`
  mutation GeneratorStartGeneration {
    GeneratorStartGeneration { code message }
  }
`;

export const GeneratorStopGeneration = gql`
  mutation GeneratorStopGeneration {
    GeneratorStopGeneration { code message }
  }
`;

export const GeneratorGenerationStatus = gql`
  query GeneratorGenerationStatus {
    GeneratorGenerationStatus { isGenerating generatedCount status }
  }
`;

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


