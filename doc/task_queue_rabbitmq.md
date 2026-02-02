1. task message header will be checked. only task message that satisfy requirements will be processed.
2. task message don't get consumed if task processing fails.
3. task message will not be consumed by another consumer when it is being processed by one consumer.