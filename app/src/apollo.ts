import { ApolloClient, InMemoryCache } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';

// GraphQL endpoint selection for dev/local vs production (Google Cloud)
const PROD_GRAPHQL_URL = import.meta.env.VITE_API_URL;
const DEV_GRAPHQL_URL = 'http://localhost:4000/graphql';

export const GRAPHQL_URL = PROD_GRAPHQL_URL || DEV_GRAPHQL_URL;

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