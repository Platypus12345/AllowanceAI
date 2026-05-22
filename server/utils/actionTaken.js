/**
 * MongoDB actionTaken.result must be a string.
 * Full tool payload is returned to the client separately as toolData / plan.
 */
function buildActionTaken(toolName, toolParams, toolResult) {
  const resultStr =
    toolResult?.message != null
      ? String(toolResult.message)
      : toolResult?.success
        ? 'Action completed'
        : 'Action failed';

  let previousValue = toolResult?.previousLimit;
  if (toolName === 'add_expense' && toolResult?.data?._id) {
    previousValue = { expenseId: String(toolResult.data._id) };
  }
  if (toolName === 'add_allowance' && toolResult?.data?.previousAllowance !== undefined) {
    previousValue = toolResult.data.previousAllowance;
  }

  const dbRecord = {
    toolName,
    toolParams,
    result: resultStr,
    success: !!toolResult?.success,
    ...(previousValue !== undefined && { previousValue }),
  };

  const clientPayload = {
    ...dbRecord,
    toolData: toolResult?.data,
    plan: toolResult?.plan,
    survivalMeta: toolResult?.survivalMeta,
  };

  return { dbRecord, clientPayload };
}

module.exports = { buildActionTaken };
