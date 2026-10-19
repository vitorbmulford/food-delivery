package com.foody.backend.shared.observability;

import java.util.Map;
import org.slf4j.MDC;
import org.springframework.core.task.TaskDecorator;

public class MdcTaskDecorator implements TaskDecorator {
    @Override
    public Runnable decorate(Runnable task) {
        Map<String, String> callerContext = MDC.getCopyOfContextMap();
        return () -> {
            Map<String, String> previous = MDC.getCopyOfContextMap();
            try {
                if (callerContext == null) MDC.clear(); else MDC.setContextMap(callerContext);
                task.run();
            } finally {
                if (previous == null) MDC.clear(); else MDC.setContextMap(previous);
            }
        };
    }
}
