/**
 * Mock for @opencode-ai/plugin/tool
 * Provides a mock `tool` factory that matches the real API shape.
 */

const toolSchema = {
  enum: (...values: string[]) => ({
    _type: "enum" as const,
    values,
    describe(desc: string) {
      return { ...this, description: desc };
    },
  }),
  string: () => ({
    _type: "string" as const,
    optional(this: any) {
      return { ...this, _optional: true };
    },
    default(v: any) {
      return { ...this, _default: v };
    },
    describe(desc: string) {
      return { ...this, description: desc };
    },
  }),
  number: () => ({
    _type: "number" as const,
    optional(this: any) {
      return { ...this, _optional: true };
    },
    default(v: number) {
      return { ...this, _default: v };
    },
    describe(desc: string) {
      return { ...this, description: desc };
    },
  }),
  boolean: () => ({
    _type: "boolean" as const,
    default(v: boolean) {
      return { ...this, _default: v };
    },
    describe(desc: string) {
      return { ...this, description: desc };
    },
  }),
};

export const tool = Object.assign(
  (config: { description: string; args: Record<string, any>; execute: (args: any, context: any) => any }) => {
    return {
      ...config,
      schema: toolSchema,
    };
  },
  { schema: toolSchema },
);

export default tool;
