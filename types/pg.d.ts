declare module "pg" {
  export class Pool {
    constructor(options: any);
    query: (text: string, params?: any[]) => Promise<any>;
    end(): Promise<void>;
  }
}

