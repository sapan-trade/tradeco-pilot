export interface BrokerNotifier {
  notifyNewCase(args: { brokerUserId: string; classificationId: string }): Promise<void>;
}

export function createBrokerNotifier(): BrokerNotifier {
  return {
    async notifyNewCase(args) {
      console.log(
        `[broker-notifier-stub] TODO: replace with real email/SMS client (broker=${args.brokerUserId}, classification=${args.classificationId}).`
      );
    },
  };
}
