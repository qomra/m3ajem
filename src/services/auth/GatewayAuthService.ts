import * as SecureStore from 'expo-secure-store';
import { GATEWAY_URL } from '@/config/gateway';

const JWT_TOKEN_KEY = 'm3ajem_gateway_jwt';

// In-memory cache for the token (fallback if SecureStore fails)
let tokenCache: string | null = null;

export interface GatewayUser {
  id: number;
  email: string;
  provider: 'google' | 'apple';
  daily_requests: number;
  daily_limit: number;
}

export interface AuthResponse {
  token: string;
  user: {
    id: number;
    email: string;
    daily_requests: number;
    daily_limit: number;
  };
}

export class GatewayAuthService {
  /**
   * Authenticate with Google (mobile SDK)
   * The app should use @react-native-google-signin/google-signin
   * to get the idToken, then send it here
   */
  static async authenticateWithGoogle(idToken: string): Promise<AuthResponse> {
    try {
      const url = `${GATEWAY_URL}/auth/google/mobile?id_token=${encodeURIComponent(idToken)}`;
      console.log('Sending request to:', `${GATEWAY_URL}/auth/google/mobile`);
      console.log('ID Token length:', idToken.length);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', JSON.stringify(response.headers, null, 2));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);

        try {
          const error = JSON.parse(errorText);
          throw new Error(error.detail || JSON.stringify(error));
        } catch {
          throw new Error(errorText || `Authentication failed with status ${response.status}`);
        }
      }

      const data: AuthResponse = await response.json();
      console.log('Authentication successful, got token');

      // Save token
      await this.saveToken(data.token);

      return data;
    } catch (error) {
      console.error('authenticateWithGoogle error:', error);
      throw error;
    }
  }

  /**
   * Authenticate with Apple (mobile SDK)
   * The app should use @invertase/react-native-apple-authentication
   * to get the identityToken and user info
   */
  static async authenticateWithApple(
    identityToken: string,
    userId: string,
    email?: string
  ): Promise<AuthResponse> {
    try {
      // Build URL with query parameters (like Google auth)
      const params = new URLSearchParams({
        identity_token: identityToken,
        user_id: userId,
      });
      if (email) {
        params.append('email', email);
      }

      const url = `${GATEWAY_URL}/auth/apple/mobile?${params.toString()}`;
      console.log('Sending Apple auth request to:', `${GATEWAY_URL}/auth/apple/mobile`);
      console.log('Identity token length:', identityToken.length);
      console.log('User ID:', userId);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Error response:', errorText);

        try {
          const error = JSON.parse(errorText);
          const errorMsg = typeof error.detail === 'string'
            ? error.detail
            : (error.message || error.error || JSON.stringify(error));
          throw new Error(errorMsg);
        } catch (parseError) {
          throw new Error(errorText || `Authentication failed with status ${response.status}`);
        }
      }

      const data: AuthResponse = await response.json();
      console.log('Apple authentication successful, got token');

      // Save token
      await this.saveToken(data.token);

      return data;
    } catch (error) {
      console.error('authenticateWithApple error:', error);
      throw error;
    }
  }

  /**
   * Get current user info
   */
  static async getCurrentUser(): Promise<GatewayUser | null> {
    const token = await this.getToken();
    if (!token) {
      console.log('getCurrentUser: No token found');
      return null;
    }

    try {
      console.log('getCurrentUser: Fetching user info from backend...');
      const response = await fetch(`${GATEWAY_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log('getCurrentUser: Response status:', response.status);

      if (!response.ok) {
        // Token expired or invalid
        const errorText = await response.text();
        console.error('getCurrentUser: Failed with status', response.status);
        console.error('getCurrentUser: Error:', errorText);
        console.log('getCurrentUser: Clearing token due to error');
        await this.clearToken();
        return null;
      }

      const user = await response.json();
      console.log('getCurrentUser: Success, user:', user.email);
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      return null;
    }
  }

  /**
   * Save JWT token to storage
   */
  static async saveToken(token: string): Promise<void> {
    console.log('Saving JWT token to SecureStore, key:', JWT_TOKEN_KEY);
    console.log('Token length:', token.length);

    // Save to cache first
    tokenCache = token;
    console.log('Token saved to in-memory cache');

    // Then save to SecureStore
    await SecureStore.setItemAsync(JWT_TOKEN_KEY, token);
    console.log('Token saved to SecureStore successfully');

    // Verify it was saved
    const saved = await SecureStore.getItemAsync(JWT_TOKEN_KEY);
    console.log('Verification - token saved to SecureStore:', saved ? 'YES' : 'NO');
  }

  /**
   * Get JWT token from storage
   */
  static async getToken(): Promise<string | null> {
    try {
      console.log('Getting JWT token...');

      // Check cache first (fast, reliable)
      if (tokenCache) {
        console.log('Token retrieved from in-memory cache:', tokenCache.substring(0, 20) + '...');
        return tokenCache;
      }

      // If not in cache, try SecureStore
      console.log('Cache miss, checking SecureStore...');
      const token = await SecureStore.getItemAsync(JWT_TOKEN_KEY);

      if (token) {
        // Update cache for future calls
        tokenCache = token;
        console.log('Token retrieved from SecureStore and cached:', token.substring(0, 20) + '...');
        return token;
      }

      console.log('No token found in cache or SecureStore');
      return null;
    } catch (error) {
      console.error('Error getting token:', error);
      // If SecureStore fails, still return cache if available
      if (tokenCache) {
        console.log('SecureStore failed but returning cached token');
        return tokenCache;
      }
      return null;
    }
  }

  /**
   * Clear JWT token (logout)
   */
  static async clearToken(): Promise<void> {
    console.log('Clearing JWT token...');
    tokenCache = null;
    await SecureStore.deleteItemAsync(JWT_TOKEN_KEY);
    console.log('Token cleared from cache and SecureStore');
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}
