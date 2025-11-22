import AsyncStorage from '@react-native-async-storage/async-storage';
import { GATEWAY_URL } from '@/config/gateway';

const JWT_TOKEN_KEY = '@m3ajem_gateway_jwt';

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
    const response = await fetch(`${GATEWAY_URL}/auth/google/mobile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ id_token: idToken }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Authentication failed');
    }

    const data: AuthResponse = await response.json();

    // Save token
    await this.saveToken(data.token);

    return data;
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
    const response = await fetch(`${GATEWAY_URL}/auth/apple/mobile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identity_token: identityToken,
        user_id: userId,
        email,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Authentication failed');
    }

    const data: AuthResponse = await response.json();

    // Save token
    await this.saveToken(data.token);

    return data;
  }

  /**
   * Get current user info
   */
  static async getCurrentUser(): Promise<GatewayUser | null> {
    const token = await this.getToken();
    if (!token) return null;

    try {
      const response = await fetch(`${GATEWAY_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // Token expired or invalid
        await this.clearToken();
        return null;
      }

      const user = await response.json();
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
    await AsyncStorage.setItem(JWT_TOKEN_KEY, token);
  }

  /**
   * Get JWT token from storage
   */
  static async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem(JWT_TOKEN_KEY);
  }

  /**
   * Clear JWT token (logout)
   */
  static async clearToken(): Promise<void> {
    await AsyncStorage.removeItem(JWT_TOKEN_KEY);
  }

  /**
   * Check if user is authenticated
   */
  static async isAuthenticated(): Promise<boolean> {
    const token = await this.getToken();
    return !!token;
  }
}
