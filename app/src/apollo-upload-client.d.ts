declare module 'apollo-upload-client' {
	export * from '@apollo/client/link/core';
	export function createUploadLink(options: any): any;
      }