/**
 * AWS configuration for the Sync & Purge mechanism.
 *
 * Replace AWS_API_ENDPOINT with your actual API Gateway URL after deploying
 * the backend Lambda. The app works fully offline without this — sync only
 * activates when connectivity is restored.
 *
 * Expected API contract:
 *   POST  {apiEndpoint}{syncPath}
 *   Body: { items: SyncQueueItem[] }
 *   Response: { syncedIds: string[] }
 */
export const AWS_CONFIG = {
  /**
   * Replace with your API Gateway URL, e.g.:
   * 'https://abc123.execute-api.ap-south-1.amazonaws.com/prod'
   */
  apiEndpoint: 'https://YOUR_API_GATEWAY_URL/prod',

  syncPath: '/sync',

  /** Request timeout in milliseconds */
  timeoutMs: 12000,

  /**
   * Optional API key for AWS API Gateway key authentication.
   * Leave empty string if using IAM/Cognito auth.
   */
  apiKey: '',
} as const;
