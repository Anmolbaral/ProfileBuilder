declare module 'graphql-upload/graphqlUploadExpress.mjs' {
  import { RequestHandler } from 'express';
  interface UploadOptions {
    maxFileSize?: number;
    maxFiles?: number;
  }
  const graphqlUploadExpress: (options?: UploadOptions) => RequestHandler;
  export default graphqlUploadExpress;
}

declare module 'graphql-upload/GraphQLUpload.mjs' {
  import { GraphQLScalarType } from 'graphql';
  const GraphQLUpload: GraphQLScalarType;
  export default GraphQLUpload;
} 