import * as utils from "@iobroker/adapter-core";

export class ProjectUtils {
	adapter: utils.AdapterInstance;

	constructor(adapter: utils.AdapterInstance) {
		this.adapter = adapter;
	}

	/**
	 * Retrieves the value of a given state by its name.
	 *
	 * @param stateName - A string representing the name of the state to retrieve.
	 * @returns A Promise that resolves with the value of the state if it exists, otherwise resolves with null.
	 */
	async getStateVal(stateName: string): Promise<any | null> {
		try {
			const stateObject = await this.asyncGetState(stateName);
			return stateObject?.val ?? null; // errors have already been handled in asyncGetState()
		} catch (error) {
			this.adapter.log.error(`[getStateValue](${stateName}): ${error}`);
			return null;
		}
	}

	/**
	 * Retrieves the state object by its name.
	 *
	 * @param stateName - A string representing the name of the state to retrieve.
	 * @returns A Promise that resolves with the object of the state if it exists, otherwise resolves with null.
	 */
	private async asyncGetState(stateName: string): Promise<any> {
		try {
			const stateObject = await this.adapter.getObjectAsync(stateName); // Check state existence
			if (!stateObject) {
				throw `State '${stateName}' does not exist.`;
			} else {
				// Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
				const stateValueObject = await this.adapter.getStateAsync(stateName);
				if (!this.isLikeEmpty(stateValueObject)) {
					return stateValueObject;
				} else {
					throw `Unable to retrieve info from state '${stateName}'.`;
				}
			}
		} catch (error) {
			this.adapter.log.error(`[asyncGetState](${stateName}): ${error}`);
			return null;
		}
	}

	/**
	 * Get foreign state value
	 * @param {string}      stateName  - Full path to state, like 0_userdata.0.other.isSummer
	 * @return {Promise<*>}            - State value, or null if error
	 */
	async asyncGetForeignStateVal(stateName: string): Promise<any | null> {
		try {
			const stateObject = await this.asyncGetForeignState(stateName);
			if (stateObject == null) return null; // errors thrown already in asyncGetForeignState()
			return stateObject.val;
		} catch (error) {
			this.adapter.log.error(`[asyncGetForeignStateValue](${stateName}): ${error}`);
			return null;
		}
	}

	/**
	 * Get foreign state
	 *
	 * @param {string}      stateName  - Full path to state, like 0_userdata.0.other.isSummer
	 * @return {Promise<object>}       - State object: {val: false, ack: true, ts: 1591117034451, …}, or null if error
	 */
	private async asyncGetForeignState(stateName: string): Promise<any> {
		try {
			const stateObject = await this.adapter.getForeignObjectAsync(stateName); // Check state existence
			if (!stateObject) {
				throw `State '${stateName}' does not exist.`;
			} else {
				// Get state value, so like: {val: false, ack: true, ts: 1591117034451, …}
				const stateValueObject = await this.adapter.getForeignStateAsync(stateName);
				if (!this.isLikeEmpty(stateValueObject)) {
					return stateValueObject;
				} else {
					throw `Unable to retrieve info from state '${stateName}'.`;
				}
			}
		} catch (error) {
			this.adapter.log.error(`[asyncGetForeignState](${stateName}): ${error}`);
			return null;
		}
	}

	/**
	 * Checks if the given input variable is effectively empty.
	 *
	 * This method examines the provided `inputVar` to determine if it contains any meaningful data.
	 * It performs a series of transformations to strip out whitespace and common punctuation, then checks if the result is an empty string.
	 *
	 * @param inputVar - The state variable to check, which can be of type `ioBroker.State`, `null`, or `undefined`.
	 * @returns A boolean indicating whether the input variable is considered empty (`true` if empty, `false` otherwise).
	 */
	private isLikeEmpty(inputVar: ioBroker.State | null | undefined): boolean {
		if (typeof inputVar !== "undefined" && inputVar !== null) {
			let sTemp = JSON.stringify(inputVar);
			sTemp = sTemp.replace(/\s+/g, ""); // remove all white spaces
			sTemp = sTemp.replace(/"+/g, ""); // remove all >"<
			sTemp = sTemp.replace(/'+/g, ""); // remove all >'<
			sTemp = sTemp.replace(/\[+/g, ""); // remove all >[<
			sTemp = sTemp.replace(/\]+/g, ""); // remove all >]<
			sTemp = sTemp.replace(/\{+/g, ""); // remove all >{<
			sTemp = sTemp.replace(/\}+/g, ""); // remove all >}<
			if (sTemp !== "") {
				return false;
			} else {
				return true;
			}
		} else {
			return true;
		}
	}
}
