import { ApolloClient, InMemoryCache } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';

// GraphQL URL - Use local server for development
const GRAPHQL_URL = 'http://localhost:4000/graphql';

// Upload link for file uploads (CSRF protection disabled on server)
const uploadLink = createUploadLink({
  uri: GRAPHQL_URL,
  headers: {},  // No custom headers needed since CSRF is disabled
  fetchOptions: {
    mode: 'cors',
    credentials: 'omit',
  },
});

export const client = new ApolloClient({
  link: uploadLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    mutate: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all'
    }
  }
});