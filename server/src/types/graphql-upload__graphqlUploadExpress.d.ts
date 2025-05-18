// server/src/types/graphql-upload__graphqlUploadExpress.d.ts
declare module 'graphql-upload/graphqlUploadExpress.mjs' {
	import { RequestHandler } from 'express';
	interface UploadOptions {
	  maxFileSize?: number;
	  maxFiles?: number;
	}
	const graphqlUploadExpress: (options?: UploadOptions) => RequestHandler;
	export default graphqlUploadExpress;
}