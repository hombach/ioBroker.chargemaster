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
			StateWallBox0ChargeCurrent: string;
			StateWallBox0ChargeAllowed: string;
			StateWallBox0ChargePower: string;
			StateWallBox0MeasuredMaxChargeAmp: string;
			MinAmpWallBox0: number;
			MaxAmpWallBox0: number;
			StateWallBox1ChargeCurrent: string;
			StateWallBox1ChargeAllowed: string;
			StateWallBox1ChargePower: string;
			StateWallBox1MeasuredMaxChargeAmp: string;
			MinAmpWallBox1: number;
			MaxAmpWallBox1: number;
			StateWallBox2ChargeCurrent: string;
			StateWallBox2ChargeAllowed: string;
			StateWallBox2ChargePower: string;
			StateWallBox2MeasuredMaxChargeAmp: string;
			MinAmpWallBox2: number;
			MaxAmpWallBox2: number;
		}
	}
}

// this is required so the above AdapterConfig is found by TypeScript / type checking
export {};
