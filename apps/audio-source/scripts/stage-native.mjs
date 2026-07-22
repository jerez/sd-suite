import { stageReleaseArtifacts, validateStagedRelease } from "./native-artifacts.mjs";

await stageReleaseArtifacts();
await validateStagedRelease();
