/**
 * Dedicated API Service for Mandis, Prices, and Dashboard.
 * Encapsulates backend endpoint communication and error handling.
 */

import apiClient from './apiClient';

export const mandiApi = {
  /**
   * Fetches high-level farmer dashboard KPIs and crop summary cards.
   * GET /api/v1/dashboard
   */
  async getDashboardSummary() {
    const response = await apiClient.get('/dashboard');
    return response.data;
  },

  /**
   * Fetches all monitored Karnataka APMC mandis.
   * GET /api/v1/mandis
   */
  async getMandis(district = null) {
    const params = district ? { district } : {};
    const response = await apiClient.get('/mandis', { params });
    return response.data;
  },

  /**
   * Fetches price and arrival records for a specific commodity.
   * GET /api/v1/prices/{crop_name}
   */
  async getCropPrices(cropName, options = {}) {
    const { mandiId, startDate, endDate, limit = 365 } = options;
    const params = { limit };
    if (mandiId) params.mandi_id = mandiId;
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;

    const response = await apiClient.get(`/prices/${encodeURIComponent(cropName)}`, { params });
    return response.data;
  },

  /**
   * General price query across commodities.
   * GET /api/v1/prices
   */
  async queryPrices(params = {}) {
    const response = await apiClient.get('/prices', { params });
    return response.data;
  },

  /**
   * Fetches AI 3-scenario forecast + anomaly detection for a crop.
   * GET /api/v1/prices/{crop_name}/forecast
   */
  async getForecast(cropName, options = {}) {
    const { mandiId, historicalDays = 90, forecastDays = 14 } = options;
    const params = { historical_days: historicalDays, forecast_days: forecastDays };
    if (mandiId) params.mandi_id = mandiId;
    const response = await apiClient.get(`/prices/${encodeURIComponent(cropName)}/forecast`, { params });
    return response.data;
  },

  /**
   * Submits a harvest-split optimization request.
   * POST /api/v1/optimizer/harvest-split
   * @param {object} payload - OptimizationRequest fields
   * @returns {Promise<object>} OptimizationResponse
   */
  async optimizeHarvestSplit(payload) {
    const response = await apiClient.post('/optimizer/harvest-split', payload);
    return response.data;
  },

  /**
   * Community & Transparency Methods
   */
  async getCommunityPosts(params = {}) {
    const response = await apiClient.get('/community/posts', { params });
    return response.data;
  },

  async createCommunityPost(payload) {
    const response = await apiClient.post('/community/posts', payload);
    return response.data;
  },

  async getCommunityPost(postId) {
    const response = await apiClient.get(`/community/posts/${encodeURIComponent(postId)}`);
    return response.data;
  },

  async addPostComment(postId, payload) {
    const response = await apiClient.post(`/community/posts/${encodeURIComponent(postId)}/comments`, payload);
    return response.data;
  },

  async markPostHelpful(postId) {
    const response = await apiClient.post(`/community/posts/${encodeURIComponent(postId)}/helpful`);
    return response.data;
  },

  async submitGrievanceReport(payload) {
    const response = await apiClient.post('/community/reports', payload);
    return response.data;
  },

  async getGrievanceReports(params = {}) {
    const response = await apiClient.get('/community/reports', { params });
    return response.data;
  },

  async getGrievanceReport(reportId) {
    const response = await apiClient.get(`/community/reports/${encodeURIComponent(reportId)}`);
    return response.data;
  },

  async getModerationQueue() {
    const response = await apiClient.get('/community/moderation/queue');
    return response.data;
  },

  async moderatePost(postId, payload) {
    const response = await apiClient.patch(`/community/moderation/posts/${encodeURIComponent(postId)}`, payload);
    return response.data;
  },

  async moderateReport(reportId, payload) {
    const response = await apiClient.patch(`/community/moderation/reports/${encodeURIComponent(reportId)}`, payload);
    return response.data;
  },

  // --- Task 7: Farmer Auth & Profile ---
  async signup(payload) {
    const response = await apiClient.post('/auth/signup', payload);
    return response.data;
  },

  async login(payload) {
    const response = await apiClient.post('/auth/login', payload);
    return response.data;
  },

  async getMe() {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  async updateProfile(payload) {
    const response = await apiClient.put('/auth/profile', payload);
    return response.data;
  },

  async logout() {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },

  async forgotPassword(payload) {
    const response = await apiClient.post('/auth/forgot-password', payload);
    return response.data;
  },

  // --- Task 7: Subscriptions ---
  async getSubscriptionPlans() {
    const response = await apiClient.get('/subscriptions/plans');
    return response.data;
  },

  async getMySubscription() {
    const response = await apiClient.get('/subscriptions/me');
    return response.data;
  },

  async checkoutSubscription(payload) {
    const response = await apiClient.post('/subscriptions/checkout', payload);
    return response.data;
  },

  async cancelSubscription() {
    const response = await apiClient.post('/subscriptions/cancel');
    return response.data;
  },

  async getSubscriptionHistory() {
    const response = await apiClient.get('/subscriptions/history');
    return response.data;
  },

  // --- Task 7: AI Prediction Protection & Claims ---
  async getProtectionPredictions() {
    const response = await apiClient.get('/protection/predictions');
    return response.data;
  },

  async getMyClaims() {
    const response = await apiClient.get('/protection/claims');
    return response.data;
  },

  async submitClaim(payload) {
    const response = await apiClient.post('/protection/claims', payload);
    return response.data;
  },

  async getClaim(claimId) {
    const response = await apiClient.get(`/protection/claims/${encodeURIComponent(claimId)}`);
    return response.data;
  },

  async getClaimAudit(claimId) {
    const response = await apiClient.get(`/protection/claims/${encodeURIComponent(claimId)}/audit`);
    return response.data;
  },

  async adminGetAllClaims() {
    const response = await apiClient.get('/admin/protection/claims');
    return response.data;
  },

  async adminReviewClaim(claimId, payload) {
    const response = await apiClient.post(`/admin/protection/claims/${encodeURIComponent(claimId)}/review`, payload);
    return response.data;
  },

  // --- Task 8: Multilingual AI Voice Chatbot ---
  async sendChatMessage(payload) {
    const response = await apiClient.post('/chatbot/message', payload);
    return response.data;
  },

  async getChatHistory(conversationId) {
    const response = await apiClient.get('/chatbot/history', {
      params: { conversation_id: conversationId }
    });
    return response.data;
  },

  async clearChatHistory(conversationId) {
    const response = await apiClient.delete('/chatbot/history', {
      params: { conversation_id: conversationId }
    });
    return response.data;
  },

  async speechToText(payload) {
    const response = await apiClient.post('/chatbot/speech-to-text', payload);
    return response.data;
  },

  // --- Task 9: Climate Intelligence & Crop Recommendation APIs ---
  async getWeatherForecast(district = 'Kolar', days = 7) {
    const response = await apiClient.get('/climate/forecast', {
      params: { district, days }
    });
    return response.data;
  },

  async getSeasonalOutlook(district = 'Kolar', season = 'Kharif') {
    const response = await apiClient.get('/climate/seasonal', {
      params: { district, season }
    });
    return response.data;
  },

  async getHistoricalClimate(district = 'Kolar') {
    const response = await apiClient.get('/climate/historical', {
      params: { district }
    });
    return response.data;
  },

  async getClimateSummary(district = 'Kolar', season = 'Kharif') {
    const response = await apiClient.get('/climate/summary', {
      params: { district, season }
    });
    return response.data;
  },

  async saveLandProfile(profilePayload) {
    const response = await apiClient.post('/crop-advisor/land-profile', profilePayload);
    return response.data;
  },

  async getMyLandProfile() {
    try {
      const response = await apiClient.get('/crop-advisor/land-profile/me');
      return response.data;
    } catch (err) {
      if (err.response && err.response.status === 404) return null;
      throw err;
    }
  },

  async getLandProfileById(id) {
    const response = await apiClient.get(`/crop-advisor/land-profile/${id}`);
    return response.data;
  },

  async generateCropRecommendations(payload) {
    const response = await apiClient.post('/crop-advisor/recommendations', payload);
    return response.data;
  },

  async getCropRecommendationById(id) {
    const response = await apiClient.get(`/crop-advisor/recommendations/${id}`);
    return response.data;
  },

  async getCropCatalog() {
    const response = await apiClient.get('/crop-advisor/crops');
    return response.data;
  }
};

export default mandiApi;
