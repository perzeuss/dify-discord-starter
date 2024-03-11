/**
 * This file contains generated types for the dify REST api. GPT-4 has been used to generate them.
 */

export interface Inputs {
  [key: string]: any;
}

export interface File {
  type: string;
  transfer_method: "remote_url" | "local_file";
  upload_file_id?: string;
  url?: string;
}

export interface ChatMessageRequest {
  inputs?: Inputs;
  query: string;
  response_mode: "blocking" | "streaming";
  conversation_id: string;
  user: string;
  files?: File[];
}

export interface ChatMessageResponse {
  answer: string;
  conversation_id: string;
  created_at: number;
  id: string;
}

export interface FeedbackRequest {
  rating: "like" | "dislike" | null;
  user: string;
}

export interface FeedbackResponse {
  has_more: boolean;
  data: FeedbackData[];
}

export interface FeedbackData {
  id: string;
  conversation_id: string;
  inputs: Inputs;
  query: string;
  answer: string;
  feedback: string;
  created_at: number;
}

export interface SuggestedQuestionsResponse {
  result: string;
  data: string[];
}

export interface ChatHistoryRequest {
  conversation_id: string;
  first_id?: string;
  limit?: number;
  user?: string;
}

export interface ChatHistoryResponse {
  has_more: boolean;
  data: ChatHistoryData[];
}

export interface ChatHistoryData {
  id: string;
  username: string;
  phone_number: string;
  avatar_url: string;
  display_name: string | null;
  conversation_id: string;
  created_at: number;
}

export interface ConversationListResponse {
  limit: number;
  has_more: boolean;
  data: ConversationData[];
}

export interface ConversationData {
  id: string;
  name: string;
  inputs: Inputs;
  status: string;
  created_at: number;
}

export interface ConversationNameRequest {
  name: string;
  user: string;
}

export interface DeleteConversationRequest {
  user: string;
}

export interface AppParametersResponse {
  introduction: string;
  user_input_form: UserInputForm[];
  file_upload: {
    image: {
      enabled: boolean;
      number_limits: number;
      transfer_methods: string[];
    };
  };
}

export interface UserInputForm {
  "text-input": {
    label: string;
    variable: string;
    required: boolean;
    max_length: number;
    default: string;
  };
}
