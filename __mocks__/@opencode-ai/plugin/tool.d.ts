/**
 * Type declarations for @opencode-ai/plugin/tool (mock)
 */
declare module "@opencode-ai/plugin/tool" {
  interface EnumSchema {
    _type: "enum";
    values: string[];
    description?: string;
    describe(desc: string): this;
  }

  interface StringSchema {
    _type: "string";
    _optional?: boolean;
    _default?: string;
    description?: string;
    optional(): this;
    default(v: string): this;
    describe(desc: string): this;
  }

  interface NumberSchema {
    _type: "number";
    _optional?: boolean;
    _default?: number;
    description?: string;
    optional(): this;
    default(v: number): this;
    describe(desc: string): this;
  }

  interface BooleanSchema {
    _type: "boolean";
    _default?: boolean;
    description?: string;
    default(v: boolean): this;
    describe(desc: string): this;
  }

  type SchemaType = EnumSchema | StringSchema | NumberSchema | BooleanSchema;

  interface ToolArgs {
    [key: string]: SchemaType;
  }

  interface ToolConfig {
    description: string;
    args: ToolArgs;
    execute(args: any, context: any): Promise<any>;
  }

  interface ToolFactory {
    (config: ToolConfig): ToolConfig;
    schema: {
      enum(...values: any[]): EnumSchema;
      string(): StringSchema;
      number(): NumberSchema;
      boolean(): BooleanSchema;
    };
  }

  export const tool: ToolFactory;
  export default tool;
}
