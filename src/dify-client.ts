import axios, { AxiosInstance } from 'axios';
import * as dotenv from 'dotenv';
import { AppParametersResponse, ChatHistoryRequest, ChatHistoryResponse, ChatMessageRequest, ChatMessageResponse, ConversationListResponse, ConversationNameRequest, DeleteConversationRequest, FeedbackRequest, FeedbackResponse, SuggestedQuestionsResponse } from './types';

dotenv.config();

class DifyChatClient {
    private axiosInstance: AxiosInstance;
    private readonly API_KEY: string;
    private readonly API_BASE_URL: string;

    constructor() {
        const apiKey = process.env.DIFY_API_KEY;
        const apiBaseUrl = process.env.DIFY_API_BASE_URL;

        if (!apiKey || !apiBaseUrl) {
            throw new Error('API_KEY and API_BASE_URL must be provided in the .env file');
        }

        this.API_KEY = apiKey;
        this.API_BASE_URL = apiBaseUrl;

        this.axiosInstance = axios.create({
            baseURL: this.API_BASE_URL,
            headers: {
                'Authorization': `Bearer ${this.API_KEY}`,
            },
        });
    }

    public async createChatMessage(request: ChatMessageRequest): Promise<ChatMessageResponse> {
        const response = await this.axiosInstance.post<ChatMessageResponse>('/chat-messages', request);
        return response.data;
    }

    public async sendFeedback(message_id: string, request: FeedbackRequest): Promise<FeedbackResponse> {
        const response = await this.axiosInstance.post<FeedbackResponse>(`/messages/${message_id}/feedbacks`, request);
        return response.data;
    }

    public async getSuggestedQuestions(message_id: string): Promise<SuggestedQuestionsResponse> {
        const response = await this.axiosInstance.get<SuggestedQuestionsResponse>(`/messages/${message_id}/suggested`);
        return response.data;
    }

    public async getChatHistory(request: ChatHistoryRequest): Promise<ChatHistoryResponse> {
        const response = await this.axiosInstance.get<ChatHistoryResponse>('/messages', {
            params: request,
        });
        return response.data;
    }

    public async getConversationList(user: string, last_id?: string, limit: number = 20): Promise<ConversationListResponse> {
        const response = await this.axiosInstance.get<ConversationListResponse>('/conversations', {
            params: { user, last_id, limit },
        });
        return response.data;
    }

    public async renameConversation(conversation_id: string, request: ConversationNameRequest): Promise<{ result: string }> {
        const response = await this.axiosInstance.post<{ result: string }>(`/conversations/${conversation_id}/name`, request);
        return response.data;
    }

    public async deleteConversation(conversation_id: string, request: DeleteConversationRequest): Promise<{ result: string }> {
        const response = await this.axiosInstance.delete<{ result: string }>(`/conversations/${conversation_id}`, { data: request });
        return response.data;
    }

    public async getAppParameters(user: string): Promise<AppParametersResponse> {
        const response = await this.axiosInstance.get<AppParametersResponse>('/parameters', {
            params: { user },
        });
        return response.data;
    }
}

export default DifyChatClient;