import { ApolloClient, InMemoryCache } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';

// GraphQL URL from environment variables
const GRAPHQL_URL = 'https://profilebuilder-uejc.onrender.com/graphql';

console.log('Using GraphQL URL:', GRAPHQL_URL); // Debug log

const uploadLink = createUploadLink({
  uri: GRAPHQL_URL,
  headers: {
    'Apollo-Require-Preflight': 'true'
  },
  fetchOptions: {
    mode: 'cors'
  }
});

export const client = new ApolloClient({
  link: uploadLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'ignore',
    },
    query: {
      fetchPolicy: 'no-cache',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all'
    }
  }
});