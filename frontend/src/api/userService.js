import axios from 'axios';
import { getApiUrl } from './config';

/**
 * Update user subscription status
 * @param {string} token - Auth token
 * @param {boolean} isSubscribed - Subscription status
 * @returns {Promise} - API response
 */
export const updateSubscriptionStatus = async (token, isSubscribed) => {
  try {
    const response = await axios.post(
      `${getApiUrl()}/user/subscription`,
      { isSubscribed },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error updating subscription status:', error);
    throw error;
  }
};

/**
 * Get user subscription status
 * @param {string} token - Auth token
 * @returns {Promise} - API response with subscription status
 */
export const getSubscriptionStatus = async (token) => {
  try {
    const response = await axios.get(
      `${getApiUrl()}/user/subscription`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting subscription status:', error);
    throw error;
  }
};

export default {
  updateSubscriptionStatus,
  getSubscriptionStatus,
}; 