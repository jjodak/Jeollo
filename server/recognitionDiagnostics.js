// Only allowlisted metadata leaves the server. Never log prompts, output text,
// raw error messages, image URLs, headers, or arbitrary incomplete_details fields.
export function recognitionDiagnosticsEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.RECOGNITION_DIAGNOSTICS === '1';
}

export function diagnosticEnum(value, allowed) {
  return value == null ? null : allowed.includes(value) ? value : 'other_redacted';
}

const number = (value) => Number.isFinite(value) && value >= 0 ? value : null;

export function safeOpenAiError(error) {
  if (!error || typeof error !== 'object') return null;
  const code = diagnosticEnum(error.code, [
    'rate_limit_exceeded', 'insufficient_quota', 'invalid_api_key', 'invalid_request',
    'invalid_value', 'invalid_parameter', 'unsupported_parameter', 'unsupported_value',
    'model_not_found', 'permission_denied', 'server_error', 'internal_error',
    'invalid_image', 'invalid_image_url', 'image_parse_error', 'image_too_large',
    'image_too_small', 'image_content_policy_violation', 'invalid_base64_image',
    'invalid_image_format', 'unsupported_image_media_type', 'failed_to_download_image',
    'invalid_prompt', 'context_length_exceeded', 'content_filter', 'timeout',
  ]);
  // Error messages can echo a signed URL, key, prompt, or customer data. Classify
  // their meaning into fixed text instead of relying on incomplete regex redaction.
  const raw = typeof error.message === 'string' ? error.message : '';
  const messages = [
    [/quota|billing/i, 'Quota or billing limit exceeded.'],
    [/rate.?limit|too many requests/i, 'Rate limit exceeded.'],
    [/api.?key|authentication/i, 'API authentication failed.'],
    [/download|fetch.*image/i, 'Reference image download failed.'],
    [/image/i, 'Image input was rejected or could not be processed.'],
    [/unsupported|not supported/i, 'A request parameter or value is unsupported.'],
    [/model.*(not found|does not exist|access)/i, 'Model not found or access denied.'],
    [/timeout|timed out/i, 'Upstream request timed out.'],
    [/server error|internal error/i, 'Upstream server error.'],
    [/invalid|validation/i, 'Request validation failed.'],
  ];
  return {
    code,
    type: diagnosticEnum(error.type, ['invalid_request_error', 'rate_limit_error',
      'authentication_error', 'permission_error', 'server_error', 'api_error',
      'insufficient_quota', 'tokens', 'requests']),
    param: diagnosticEnum(error.param, ['model', 'input', 'text', 'text.format',
      'max_output_tokens', 'reasoning', 'reasoning.effort', 'text.verbosity',
      'temperature', 'top_p', 'image_url']),
    message: messages.find(([pattern]) => pattern.test(raw))?.[1]
      ?? (raw ? 'Upstream message withheld; use code, type and upstreamRequestId.' : null),
    messageSanitized: true,
  };
}

export function readOpenAiDiagnostics(response, body) {
  const requestId = response.headers.get('x-request-id');
  const output = Array.isArray(body?.output) ? body.output : [];
  const outputText = typeof body?.output_text === 'string' ? body.output_text
    : output.flatMap((item) => Array.isArray(item?.content) ? item.content : [])
      .find((content) => content?.type === 'output_text' && typeof content.text === 'string')?.text ?? '';
  return {
    outputTextLength: outputText.length,
    httpStatus: response.status,
    upstreamRequestId: /^req_[a-zA-Z0-9_-]{1,100}$/.test(requestId ?? '') ? requestId : null,
    status: diagnosticEnum(body?.status, ['completed', 'incomplete', 'failed', 'in_progress', 'queued', 'cancelled']),
    incompleteDetails: body?.incomplete_details == null ? null : {
      reason: diagnosticEnum(body.incomplete_details.reason, ['max_output_tokens', 'content_filter']),
    },
    error: safeOpenAiError(body?.error),
    usage: {
      inputTokens: number(body?.usage?.input_tokens),
      cachedInputTokens: number(body?.usage?.input_tokens_details?.cached_tokens),
      outputTokens: number(body?.usage?.output_tokens),
      reasoningTokens: number(body?.usage?.output_tokens_details?.reasoning_tokens),
      totalTokens: number(body?.usage?.total_tokens),
    },
    resolvedReasoningEffort: diagnosticEnum(body?.reasoning?.effort, ['minimal', 'low', 'medium', 'high', 'none', 'xhigh']),
    resolvedVerbosity: diagnosticEnum(body?.text?.verbosity, ['low', 'medium', 'high']),
    outputItemCount: output.length,
    reasoningItemCount: output.filter((item) => item?.type === 'reasoning').length,
    hasRefusal: output.some((item) => Array.isArray(item?.content)
      && item.content.some((content) => content?.type === 'refusal')),
  };
}

export function logOpenAiAttempt(diagnostic) {
  if (recognitionDiagnosticsEnabled()) console.info('recognition:openai', JSON.stringify(diagnostic));
  else if (diagnostic.outcome !== 'completed') console.warn('recognition:openai', JSON.stringify(diagnostic));
}
