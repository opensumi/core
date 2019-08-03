import { RequirementsData } from './requirements';

export interface ExtensionAPI {
    readonly apiVersion: string;
	readonly javaRequirement: RequirementsData;
	readonly status: "Started" | "Error";
}
