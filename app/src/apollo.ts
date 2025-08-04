import { ApolloClient, InMemoryCache } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';

// GraphQL URL from environment variables
// const GRAPHQL_URL = 'https://pdf-extractor-server-xxxxx-uc.a.run.app/graphql';
const GRAPHQL_URL = 'http://localhost:4000/graphql';

console.log('Using GraphQL URL:', GRAPHQL_URL);

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
      fetchPolicy: 'network-only',
      errorPolicy: 'ignore',
    },
    query: {
      fetchPolicy: 'network-only',
      errorPolicy: 'all',
    },
    mutate: {
      errorPolicy: 'all'
    }
  }
});

// Clear the cache on initialization for better file handeling
client.resetStore();