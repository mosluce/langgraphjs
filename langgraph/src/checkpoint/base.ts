import { RunnableConfig } from "@langchain/core/runnables";
import { SerializerProtocol } from "../serde/base.js";

/** A field that can be configured by the user. It is a specification of a field. */
export interface ConfigurableFieldSpec {
  id: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  annotation: any;
  name: string | null;
  description: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  default: any;
  /**
   * @default false
   */
  isShared?: boolean;
  dependencies: Array<string> | null;
}

export interface CheckpointMetadata {
  source: "input" | "loop" | "update";
  /**
   * The source of the checkpoint.
   * - "input": The checkpoint was created from an input to invoke/stream/batch.
   * - "loop": The checkpoint was created from inside the pregel loop.
   * - "update": The checkpoint was created from a manual state update. */
  step: number;
  /**
   * The step number of the checkpoint.
   * -1 for the first "input" checkpoint.
   * 0 for the first "loop" checkpoint.
   * ... for the nth checkpoint afterwards. */
  writes?: Record<string, unknown>;
  /**
   * The writes that were made between the previous checkpoint and this one.
   * Mapping from node name to writes emitted by that node.
   */
}

export interface Checkpoint {
  /**
   * Version number
   */
  v: number;
  /**
   * Timestamp {new Date().toISOString()}
   */
  ts: string;
  /**
   * @default {}
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  channelValues: Record<string, any>;
  /**
   * @default {}
   */
  channelVersions: Record<string, number>;
  /**
   * @default {}
   */
  versionsSeen: Record<string, Record<string, number>>;
}

export function deepCopy<T>(obj: T): T {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }

  const newObj = Array.isArray(obj) ? [] : {};

  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      (newObj as Record<PropertyKey, unknown>)[key] = deepCopy(
        (obj as Record<string, unknown>)[key]
      );
    }
  }

  return newObj as T;
}

export function emptyCheckpoint(): Checkpoint {
  return {
    v: 1,
    ts: new Date().toISOString(),
    channelValues: {},
    channelVersions: {},
    versionsSeen: {},
  };
}

export function copyCheckpoint(checkpoint: Checkpoint): Checkpoint {
  return {
    v: checkpoint.v,
    ts: checkpoint.ts,
    channelValues: { ...checkpoint.channelValues },
    channelVersions: { ...checkpoint.channelVersions },
    versionsSeen: deepCopy(checkpoint.versionsSeen),
  };
}

export interface CheckpointTuple {
  config: RunnableConfig;
  checkpoint: Checkpoint;
  metadata?: CheckpointMetadata;
  parentConfig?: RunnableConfig;
}

const CheckpointThreadId: ConfigurableFieldSpec = {
  id: "threadId",
  annotation: typeof "",
  name: "Thread ID",
  description: null,
  default: "",
  isShared: true,
  dependencies: null,
};

const CheckpointThreadTs: ConfigurableFieldSpec = {
  id: "threadTs",
  annotation: typeof "",
  name: "Thread Timestamp",
  description:
    "Pass to fetch a past checkpoint. If None, fetches the latest checkpoint.",
  default: null,
  isShared: true,
  dependencies: null,
};

export abstract class BaseCheckpointSaver {
  serde: SerializerProtocol<unknown> = JSON;

  constructor(serde?: SerializerProtocol<unknown>) {
    this.serde = serde || this.serde;
  }

  get configSpecs(): Array<ConfigurableFieldSpec> {
    return [CheckpointThreadId, CheckpointThreadTs];
  }

  async get(config: RunnableConfig): Promise<Checkpoint | undefined> {
    const value = await this.getTuple(config);
    return value ? value.checkpoint : undefined;
  }

  abstract getTuple(
    config: RunnableConfig
  ): Promise<CheckpointTuple | undefined>;

  abstract list(config: RunnableConfig): AsyncGenerator<CheckpointTuple>;

  abstract put(
    config: RunnableConfig,
    checkpoint: Checkpoint,
    metadata: CheckpointMetadata
  ): Promise<RunnableConfig>;
}
