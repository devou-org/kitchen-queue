declare module 'qz-lna' {
  export type AddressSpace = 'loopback' | 'local' | 'public';

  export interface AddressSpaceOverrides {
    targetAddressSpace?: AddressSpace;
    originAddressSpace?: AddressSpace;
  }

  export interface LnaOptions {
    overrides?: AddressSpaceOverrides;
    defaultAddressSpace?: AddressSpace;
    isWebSocket?: boolean;
    isConnectionError?: (err: unknown) => boolean;
  }

  export const defaultOptions: LnaOptions;

  export type Resource = string | URL | Request;
  export type Promisify<T> = Promise<Awaited<T>>;

  export function detectLna<R>(
    resource: Resource,
    callback: (url: string | URL) => R,
    options?: LnaOptions
  ): Promisify<R>;

  export class LnaError extends Error {
    denied: boolean | undefined;
    permission?: PermissionStatus;
    constructor(options: {
      denied: boolean | undefined;
      permission?: PermissionStatus | null;
      cause: unknown;
    });
    static fromPermission(
      permission: PermissionStatus | null | undefined,
      cause: unknown
    ): LnaError;
  }

  export const __v: number;
}
