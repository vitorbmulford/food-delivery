package com.foody.backend.shared.observability;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

class MdcTaskDecoratorTest {
    @AfterEach void clean() { MDC.clear(); }

    @Test
    void propagatesAndDoesNotLeakAcrossReusedWorkerThread() throws Exception {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setTaskDecorator(new MdcTaskDecorator());
        executor.initialize();
        try {
            AtomicReference<String> first = new AtomicReference<>();
            CountDownLatch done = new CountDownLatch(1);
            MDC.put("correlationId", "request-one");
            executor.execute(() -> { first.set(MDC.get("correlationId")); done.countDown(); });
            assertThat(done.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(first.get()).isEqualTo("request-one");

            MDC.clear();
            AtomicReference<String> second = new AtomicReference<>();
            CountDownLatch secondDone = new CountDownLatch(1);
            executor.execute(() -> { second.set(MDC.get("correlationId")); secondDone.countDown(); });
            assertThat(secondDone.await(2, TimeUnit.SECONDS)).isTrue();
            assertThat(second.get()).isNull();
        } finally {
            executor.shutdown();
        }
    }
}
