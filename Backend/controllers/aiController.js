const DEFAULT_OLLAMA_BASE_URL = "http://127.0.0.1:11434";
const DEFAULT_OLLAMA_MODEL = "llama3.2";

const getPromptFromBody = (body = {}) => {
    const candidates = [body.prompt, body.message, body.content, body.text, body.currentDetail];

    for (const value of candidates) {
        if (typeof value === "string" && value.trim()) {
            return value.trim();
        }
    }

    return "";
};

const buildSystemInstruction = () => (
    "You are a helpful AI assistant for an app workspace. Keep replies practical, clear, and user-friendly."
);

const getHistoryFromBody = (body = {}) => {
    if (!Array.isArray(body.history)) {
        return [];
    }

    return body.history
        .map((entry) => {
            const role = entry?.role === "assistant" ? "assistant" : "user";
            const content = typeof entry?.content === "string" ? entry.content.trim() : "";

            if (!content) {
                return null;
            }

            return { role, content };
        })
        .filter(Boolean)
        .slice(-12);
};

const normalizeBaseUrl = (url) => {
    if (typeof url !== "string" || !url.trim()) {
        return DEFAULT_OLLAMA_BASE_URL;
    }

    return url.trim().replace(/\/+$/, "");
};

const getTimeoutMs = () => {
    const parsed = Number(process.env.AI_TIMEOUT_MS);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return 180000;
    }

    return parsed;
};

const listOllamaModels = async (baseUrl, signal) => {
    const response = await fetch(`${baseUrl}/api/tags`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
        signal,
    });

    if (!response.ok) {
        return [];
    }

    const payload = await response.json().catch(() => ({}));
    const models = Array.isArray(payload?.models) ? payload.models : [];

    return models
        .map((entry) => (typeof entry?.name === "string" ? entry.name.trim() : ""))
        .filter(Boolean);
};

const pickBestModelName = (requestedModel, availableModels = []) => {
    if (!requestedModel) {
        return "";
    }

    const normalizedRequested = requestedModel.trim();

    if (!normalizedRequested) {
        return "";
    }

    if (availableModels.includes(normalizedRequested)) {
        return normalizedRequested;
    }

    if (!normalizedRequested.includes(":")) {
        const withLatest = `${normalizedRequested}:latest`;

        if (availableModels.includes(withLatest)) {
            return withLatest;
        }
    }

    const requestedBase = normalizedRequested.split(":")[0];
    const baseMatch = availableModels.find((name) => name.split(":")[0] === requestedBase);

    if (baseMatch) {
        return baseMatch;
    }

    return normalizedRequested;
};

const chatWithOllama = async ({ prompt, history, abortSignal }) => {
    const baseUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL);
    const requestedModel = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
    const timeoutMs = getTimeoutMs();
    const controller = new AbortController();
    let didTimeout = false;
    const timeoutId = setTimeout(() => {
        didTimeout = true;
        controller.abort();
    }, timeoutMs);

    const handleExternalAbort = () => {
        controller.abort();
    };

    if (abortSignal) {
        if (abortSignal.aborted) {
            controller.abort();
        } else {
            abortSignal.addEventListener("abort", handleExternalAbort);
        }
    }

    try {
        const availableModels = await listOllamaModels(baseUrl, controller.signal).catch(() => []);
        const model = pickBestModelName(requestedModel, availableModels);

        const sendChat = async (modelName) => fetch(`${baseUrl}/api/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: modelName,
                stream: false,
                messages: [
                    { role: "system", content: buildSystemInstruction() },
                    ...history,
                    { role: "user", content: prompt },
                ],
            }),
            signal: controller.signal,
        });

        let response = await sendChat(model);
        let payload = await response.json().catch(() => ({}));

        if (!response.ok && response.status === 404 && typeof payload?.error === "string" && /model .* not found/i.test(payload.error)) {
            const fallbackModel = pickBestModelName(model, availableModels);

            if (fallbackModel && fallbackModel !== model) {
                response = await sendChat(fallbackModel);
                payload = await response.json().catch(() => ({}));
            }
        }

        if (!response.ok) {
            const availableModelsMessage = availableModels.length
                ? ` Available models: ${availableModels.join(", ")}`
                : "";
            const message = typeof payload?.error === "string"
                ? `${payload.error}${availableModelsMessage}`
                : `Ollama request failed (${response.status}).${availableModelsMessage}`;
            const error = new Error(message);
            error.status = response.status;
            throw error;
        }

        const content = payload?.message?.content;

        if (typeof content !== "string" || !content.trim()) {
            const error = new Error("Ollama returned an empty response.");
            error.status = 502;
            throw error;
        }

        return content.trim();
    } catch (error) {
        if (error?.name === "AbortError") {
            if (!didTimeout) {
                const canceledError = new Error("AI response was stopped.");
                canceledError.status = 499;
                throw canceledError;
            }

            const timeoutError = new Error(
                `Ollama response timed out after ${timeoutMs}ms. Increase AI_TIMEOUT_MS in Backend/.env (e.g. 180000 or 300000).`,
            );
            timeoutError.status = 504;
            throw timeoutError;
        }

        const rawMessage = error?.message || "Unable to reach Ollama service.";
        const hasNetworkFailure = /fetch failed|ECONNREFUSED|ENOTFOUND/i.test(rawMessage);

        if (hasNetworkFailure) {
            const unavailableError = new Error(
                "Ollama is not reachable. Start Ollama and run `ollama pull llama3.2`, then retry.",
            );
            unavailableError.status = 503;
            throw unavailableError;
        }

        throw error;
    } finally {
        clearTimeout(timeoutId);

        if (abortSignal) {
            abortSignal.removeEventListener("abort", handleExternalAbort);
        }
    }
};

export const aiHealth = async (req, res) => {
    const baseUrl = normalizeBaseUrl(process.env.OLLAMA_BASE_URL);
    const requestedModel = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
    const timeoutMs = getTimeoutMs();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const availableModels = await listOllamaModels(baseUrl, controller.signal);
        const resolvedModel = pickBestModelName(requestedModel, availableModels);
        const isConfiguredModelAvailable = availableModels.includes(resolvedModel);

        return res.status(200).json({
            provider: "ollama",
            connected: true,
            baseUrl,
            requestedModel,
            resolvedModel,
            isConfiguredModelAvailable,
            models: availableModels,
        });
    } catch (error) {
        if (error?.name === "AbortError") {
            return res.status(504).json({
                provider: "ollama",
                connected: false,
                baseUrl,
                requestedModel,
                message: `Ollama health check timed out after ${timeoutMs}ms.`,
                models: [],
            });
        }

        const message = error?.message || "Unable to reach Ollama service.";

        return res.status(503).json({
            provider: "ollama",
            connected: false,
            baseUrl,
            requestedModel,
            message,
            models: [],
        });
    } finally {
        clearTimeout(timeoutId);
    }
};

export const aiChat = async (req, res) => {
    const requestAbortController = new AbortController();

    try {
        const prompt = getPromptFromBody(req.body);
        const history = getHistoryFromBody(req.body);

        if (!prompt) {
            return res.status(400).json({
                message: "Prompt is required. Send one of: prompt, message, content, text, or currentDetail.",
            });
        }

        const responseText = await chatWithOllama({
            prompt,
            history,
            abortSignal: requestAbortController.signal,
        });

        if (res.headersSent || res.writableEnded) {
            return;
        }

        res.status(200).json({
            response: responseText,
            provider: "ollama",
        });
    } catch (error) {
        if (error?.status === 499 || res.writableEnded) {
            return;
        }

        console.error("AI chat error:", {
            status: error?.status,
            code: error?.code,
            type: error?.type,
            message: error?.message,
        });

        if (res.headersSent) {
            return;
        }

        res.status(error?.status || 500).json({
            message: error?.message || "Server error",
        });
    }
};