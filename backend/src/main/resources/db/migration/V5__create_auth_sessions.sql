CREATE TABLE auth_sessions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT uk_auth_sessions_token_hash UNIQUE (token_hash)
);

CREATE INDEX idx_auth_sessions_user_id ON auth_sessions(user_id);
