import axios, { AxiosInstance } from "axios";
import * as dotenv from "dotenv";
import { unicodeToChar } from "./helpers";
import type {
  AppParametersResponse,
  ChatHistoryRequest,
  ChatHistoryResponse,
  ChatMessageRequest,
  ConversationListResponse,
  ConversationNameRequest,
  DeleteConversationRequest,
  FeedbackRequest,
  FeedbackResponse,
  SuggestedQuestionsResponse,
} from "./api.types";
import type {
  IOnCompleted,
  IOnData,
  IOnFile,
  IOnMessageEnd,
  IOnMessageReplace,
  IOnThought,
  IOtherOptions,
  IOnWorkflowStarted,
  IOnWorkflowFinished,
  IOnNodeStarted,
  IOnNodeFinished,
  MessageEnd,
  MessageReplace,
  ThoughtItem,
  VisionFile,
  WorkflowStarted,
  WorkflowFinished,
  NodeStarted,
  NodeFinished,
} from "./dify.types";

dotenv.config();

class DifyChatClient {
  private axiosInstance: AxiosInstance;
  private readonly API_KEY: string;
  private readonly API_BASE_URL: string;
  constructor() {
    const apiKey = process.env.DIFY_API_KEY;
    const apiBaseUrl = process.env.DIFY_API_BASE_URL;

    if (!apiKey || !apiBaseUrl) {
      throw new Error(
        "API_KEY and API_BASE_URL must be provided in the .env file"
      );
    }

    this.API_KEY = apiKey;
    this.API_BASE_URL = apiBaseUrl;

    this.axiosInstance = axios.create({
      baseURL: this.API_BASE_URL,
      headers: {
        Authorization: `Bearer ${this.API_KEY}`,
      },
    });
  }

  ssePost(
    url: string,
    fetchOptions: any,
    {
      onData,
      onCompleted,
      onThought,
      onFile,
      onMessageEnd,
      onWorkflowStarted,
      onWorkflowFinished,
      onNodeStarted,
      onNodeFinished,
      onMessageReplace,
      onError,
      getAbortController,
      onPing,
    }: IOtherOptions & { onPing?: () => void }
  ) {
    const abortController = new AbortController();
    const baseOptions = {
      method: "GET",
      mode: "cors",
      credentials: "include", // always send cookies、HTTP Basic authentication.
      headers: new Headers({
        "Content-Type": "application/json",
      }),
      redirect: "follow",
    };

    const options = Object.assign(
      {},
      baseOptions,
      {
        method: "POST",
        signal: abortController.signal,
      },
      fetchOptions
    );

    const contentType = options.headers.get("Content-Type");
    if (!contentType) options.headers.set("Content-Type", "application/json");

    getAbortController?.(abortController);

    const urlWithPrefix = url;

    const { body } = options;
    if (body) options.body = JSON.stringify(body);

    globalThis
      .fetch(urlWithPrefix, options as RequestInit)
      .then((res) => {
        if (!/^(2|3)\d{2}$/.test(String(res.status))) {
          res.json().then((data: any) => {
            console.error({
              type: "error",
              message: data.message || "Server Error",
            });
          });
          onError?.(`Server Error. Status Code: ${res.status}`);
          return;
        }
        return this.handleStream(
          res,
          (str: string, isFirstMessage: boolean, moreInfo: any) => {
            if (moreInfo.errorMessage) {
              onError?.(moreInfo.errorMessage, moreInfo.errorCode);
              if (
                moreInfo.errorMessage !==
                "AbortError: The user aborted a request."
              )
                console.error(moreInfo.errorMessag);
              return;
            }
            onData?.(str, isFirstMessage, moreInfo);
          },
          onCompleted,
          onThought,
          onMessageEnd,
          onMessageReplace,
          onWorkflowStarted,
          onWorkflowFinished,
          onNodeStarted,
          onNodeFinished,
          onFile,
          onPing
        );
      })
      .catch((e) => {
        if (e.toString() !== "AbortError: The user aborted a request.")
          console.error(e);
        onError?.(e);
      });
  }

  handleStream(
    response: Response,
    onData: IOnData,
    onCompleted?: IOnCompleted,
    onThought?: IOnThought,
    onMessageEnd?: IOnMessageEnd,
    onMessageReplace?: IOnMessageReplace,
    onWorkflowStarted?: IOnWorkflowStarted,
    onWorkflowFinished?: IOnWorkflowFinished,
    onNodeStarted?: IOnNodeStarted,
    onNodeFinished?: IOnNodeFinished,
    onFile?: IOnFile,
    onPing?: () => void
  ) {
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let bufferObj: Record<string, any>;
    let isFirstMessage = true;
    function read() {
      let hasError = false;
      reader?.read().then((result: any) => {
        if (result.done) {
          onCompleted && onCompleted();
          return;
        }
        buffer += decoder.decode(result.value, { stream: true });
        const lines = buffer.split("\n");
        try {
          lines.forEach((message) => {
            try {
              if (message.length === 0) return;
              if (message.endsWith("ping")) {
                return onPing?.();
              }

              if (message.startsWith("data: ")) {
                bufferObj = JSON.parse(message.substring(6)) as Record<
                  string,
                  any
                >;
              } else {
                bufferObj = JSON.parse(message) as Record<string, any>;
              }
            } catch (e) {
              // line is not yet complete; buffer it and wait for the next chunk
              onData("", isFirstMessage, {
                conversationId: bufferObj?.conversation_id,
                messageId: bufferObj?.message_id,
              });
              return;
            }

            if (bufferObj.status === 400 || !bufferObj.event) {
              onData("", false, {
                conversationId: undefined,
                messageId: "",
                errorMessage: bufferObj?.message,
                errorCode: bufferObj?.code,
              });
              hasError = true;
              onCompleted?.(true);
              return;
            }
            if (
              bufferObj.event === "message" ||
              bufferObj.event === "agent_message"
            ) {
              onData(unicodeToChar(bufferObj.answer), isFirstMessage, {
                conversationId: bufferObj.conversation_id,
                taskId: bufferObj.task_id,
                messageId: bufferObj.id,
              });
              isFirstMessage = false;
            } else if (bufferObj.event === "agent_thought") {
              onThought?.(bufferObj as ThoughtItem);
            } else if (bufferObj.event === "message_file") {
              onFile?.(bufferObj as VisionFile);
            } else if (bufferObj.event === "message_end") {
              onMessageEnd?.(bufferObj as MessageEnd);
            } else if (bufferObj.event === "message_replace") {
              onMessageReplace?.(bufferObj as MessageReplace);
            } else if (bufferObj.event === "workflow_started") {
              onWorkflowStarted?.(bufferObj as WorkflowStarted);
            } else if (bufferObj.event === "workflow_finished") {
              onWorkflowFinished?.(bufferObj as WorkflowFinished);
            } else if (bufferObj.event === "node_started") {
              onNodeStarted?.(bufferObj as NodeStarted);
            } else if (bufferObj.event === "node_finished") {
              onNodeFinished?.(bufferObj as NodeFinished);
            }
          });
          buffer = lines[lines.length - 1];
        } catch (e) {
          console.error(e);
          onData("", false, {
            conversationId: undefined,
            messageId: "",
            errorMessage: `${e}`,
          });
          hasError = true;
          onCompleted?.(true);
          return;
        }
        if (!hasError) read();
      });
    }
    read();
  }

  public async streamChatMessage(
    body: ChatMessageRequest,
    {
      onMessage,
      onCompleted,
      onFile,
      onPing,
      onThought,
      onWorkflowStarted,
      onWorkflowFinished,
      onNodeStarted,
      onNodeFinished,
    }: {
      onMessage: (
        text: string,
        isFirstMessage: boolean,
        { conversationId }: { conversationId: string }
      ) => void;
      onCompleted?: () => void;
      onFile?: (file: VisionFile) => void;
      onPing?: () => void;
      onThought?: IOnThought;
      onWorkflowStarted?: IOnWorkflowStarted;
      onWorkflowFinished?: IOnWorkflowFinished;
      onNodeStarted?: IOnNodeStarted;
      onNodeFinished?: IOnNodeFinished;
    }
  ): Promise<void> {
    this.ssePost(
      `${this.API_BASE_URL}/chat-messages`,
      {
        method: "POST",
        body,
        headers: new Headers({
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.API_KEY}`,
        }),
      },
      {
        onData: (text: string, isFirstMessage: boolean, moreInfo: any) => {
          onMessage(text, isFirstMessage, moreInfo);
        },
        onCompleted: () => {
          onCompleted?.();
        },
        onError: (error: any) => {
          console.error(error);
        },
        onFile,
        onPing,
        onThought,
        onWorkflowStarted,
        onWorkflowFinished,
        onNodeStarted,
        onNodeFinished,
      }
    );
  }

  public async sendFeedback(
    message_id: string,
    request: FeedbackRequest
  ): Promise<FeedbackResponse> {
    const response = await this.axiosInstance.post<FeedbackResponse>(
      `/messages/${message_id}/feedbacks`,
      request
    );
    return response.data;
  }

  public async getSuggestedQuestions(
    message_id: string
  ): Promise<SuggestedQuestionsResponse> {
    const response = await this.axiosInstance.get<SuggestedQuestionsResponse>(
      `/messages/${message_id}/suggested`
    );
    return response.data;
  }

  public async getChatHistory(
    request: ChatHistoryRequest
  ): Promise<ChatHistoryResponse> {
    const response = await this.axiosInstance.get<ChatHistoryResponse>(
      "/messages",
      {
        params: request,
      }
    );
    return response.data;
  }

  public async getConversationList(
    user: string,
    last_id?: string,
    limit: number = 20
  ): Promise<ConversationListResponse> {
    const response = await this.axiosInstance.get<ConversationListResponse>(
      "/conversations",
      {
        params: { user, last_id, limit },
      }
    );
    return response.data;
  }

  public async renameConversation(
    conversation_id: string,
    request: ConversationNameRequest
  ): Promise<{ result: string }> {
    const response = await this.axiosInstance.post<{ result: string }>(
      `/conversations/${conversation_id}/name`,
      request
    );
    return response.data;
  }

  public async deleteConversation(
    conversation_id: string,
    request: DeleteConversationRequest
  ): Promise<{ result: string }> {
    const response = await this.axiosInstance.delete<{ result: string }>(
      `/conversations/${conversation_id}`,
      { data: request }
    );
    return response.data;
  }

  public async getAppParameters(user: string): Promise<AppParametersResponse> {
    const response = await this.axiosInstance.get<AppParametersResponse>(
      "/parameters",
      {
        params: { user },
      }
    );
    return response.data;
  }
}

export default DifyChatClient;
