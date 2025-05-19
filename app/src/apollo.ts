import { ApolloClient, InMemoryCache } from '@apollo/client';
import { createUploadLink } from 'apollo-upload-client';

//Commented the local host while using render
// GraphQL URL from environment variables
// const GRAPHQL_URL = 'http://localhost:4000/graphql';
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