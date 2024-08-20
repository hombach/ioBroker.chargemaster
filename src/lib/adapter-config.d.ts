// This file extends the AdapterConfig type from "@types/iobroker"

// Augment the globally declared type ioBroker.AdapterConfig
declare global {
	namespace ioBroker {
		interface AdapterConfig {
			cycleTime: number;
			maxAmpTotal: number;
			stateHomeBatSoc: string;
			stateHomeSolarPower: string;
			stateHomePowerConsumption: string;
			wallBoxList: [
				{
					stateChargeCurrent: string;
					stateChargeAllowed: string;
					stateActiveChargePower: string;
					stateActiveChargeAmp: string;
					minAmp: number;
					maxAmp: number;
				},
			];
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
