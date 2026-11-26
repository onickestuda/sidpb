// Incremental configuration: never writes users, credentials, links or client IDs.
export async function configureIdentity(api) {
  const alias = 'sidpb-first-broker-login';
  const providers = await api('GET', '/identity-provider/instances');
  const google = providers.find(provider => provider.alias === 'google' && provider.providerId === 'google');
  if (!google) throw new Error('Existing Google provider is required');
  if (google.firstBrokerLoginFlowAlias && !['first broker login', alias].includes(google.firstBrokerLoginFlowAlias)) {
    throw new Error('Google already uses a custom broker flow; review it before replacing its protections');
  }
  const flows = await api('GET', '/authentication/flows');
  if (!flows.some(flow => flow.alias === alias)) {
    // Copy the native verification flow, including email and reauthentication checks.
    await api('POST', '/authentication/flows/first%20broker%20login/copy', { newName: alias });
  }
  const path = `/authentication/flows/${alias}/executions`;
  const executions = await api('GET', path);
  const native = await api('GET', '/authentication/flows/first%20broker%20login/executions');
  const optional = ['idp-review-profile', 'idp-confirm-link'];
  // Validate the whole hierarchy, not just leaves: a disabled parent can bypass proof.
  const shape = rows => rows.map(row => ({ providerId: row.providerId,
    flow: !!row.authenticationFlow, level: row.level, index: row.index,
    requirement: optional.includes(row.providerId) ? 'DISABLED' : row.requirement }));
  if (JSON.stringify(shape(executions)) !== JSON.stringify(shape(native))) {
    throw new Error('Broker flow differs from the native verification hierarchy; manual review required');
  }
  const required = ['idp-review-profile', 'idp-create-user-if-unique', 'idp-confirm-link',
    'idp-email-verification', 'idp-username-password-form'];
  for (const id of required) {
    if (!executions.some(execution => execution.providerId === id)) throw new Error(`Missing native verification: ${id}`);
  }
  if (executions.some(execution => /auto-link|auto-linking/.test(execution.providerId || ''))) {
    throw new Error('Automatic linking is not allowed');
  }
  for (const execution of executions) {
    const requirement = ['idp-review-profile', 'idp-confirm-link'].includes(execution.providerId)
      ? 'DISABLED' : execution.requirement;
    if (requirement !== execution.requirement) await api('PUT', path, { ...execution, requirement });
  }
  // Refuse to attach a flow whose proof-of-ownership mechanisms were disabled.
  for (const id of ['idp-email-verification', 'idp-username-password-form']) {
    if (executions.find(execution => execution.providerId === id).requirement === 'DISABLED') {
      throw new Error(`Verification must remain enabled: ${id}`);
    }
  }
  if (google.firstBrokerLoginFlowAlias !== alias) {
    await api('PUT', '/identity-provider/instances/google', {
      ...google, firstBrokerLoginFlowAlias: alias,
    });
  }
  console.log('Google first login configured; native ownership verification and existing links preserved.');
}
