1. task message header will be checked. only task message that satisfy requirements will be processed.
   - Publisher puts taskType in message header
   - Consumer checks header against SUPPORTED_TASK_TYPES set before processing

2. task message don't get consumed if task processing fails.
   - AcknowledgeMode.MANUAL in listener container factory
   - Consumer calls basicAck only after successful execution, basicNack on failure (requeue=true)

3. task message will not be consumed by another consumer when it is being processed by one consumer.
   - prefetchCount=1 setting ensures one unacknowledged message per consumer
   - Message locked until ack/nack, automatically requeued if consumer dies