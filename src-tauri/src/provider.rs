use serde::{Deserialize, Serialize};

const ANTHROPIC_PREFIX: &str = "sk-ant-";
const OPENAI_PREFIX: &str = "sk-";
const OPENAI_ADMIN_PREFIX: &str = "sk-admin-";
const MIN_KEY_LENGTH: usize = 20;

/// Pre-2.1 single-key field, migrated into the Anthropic slot on first launch.
pub const LEGACY_KEY_FIELD: &str = "api_key";

/// Declared as an enum rather than a string so an unknown value is rejected at the
/// IPC boundary instead of by hand-written checks further in.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Provider {
    Anthropic,
    OpenAI,
}

impl Provider {
    pub fn key_field(self) -> &'static str {
        match self {
            Provider::Anthropic => "anthropic_api_key",
            Provider::OpenAI => "openai_api_key",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Provider::Anthropic => "Anthropic",
            Provider::OpenAI => "OpenAI",
        }
    }
}

/// Catch keys that cannot possibly work before they are stored, so the user gets a
/// message naming the problem instead of a confusing 401 on their first summary.
/// Expects an already-trimmed key.
pub fn validate_key(provider: Provider, key: &str) -> Result<(), String> {
    match provider {
        Provider::Anthropic => {
            if !key.starts_with(ANTHROPIC_PREFIX) {
                return Err(format!("Anthropic keys start with '{ANTHROPIC_PREFIX}'."));
            }
        }
        Provider::OpenAI => {
            // Both vendors' keys start with "sk-", so this has to be checked explicitly.
            if key.starts_with(ANTHROPIC_PREFIX) {
                return Err(
                    "That is an Anthropic key. Paste it into the Anthropic box instead."
                        .to_string(),
                );
            }
            if key.starts_with(OPENAI_ADMIN_PREFIX) {
                return Err(
                    "Admin keys only manage your account and cannot call models. Create a project key instead."
                        .to_string(),
                );
            }
            if !key.starts_with(OPENAI_PREFIX) {
                return Err(format!("OpenAI keys start with '{OPENAI_PREFIX}'."));
            }
        }
    }

    if key.len() < MIN_KEY_LENGTH {
        return Err(format!(
            "That {} key looks too short to be valid.",
            provider.label()
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    const ANTHROPIC_KEY: &str = "sk-ant-api03-0123456789abcdef";
    const PROJECT_KEY: &str = "sk-proj-0123456789abcdef0123";

    #[test]
    fn key_validation_accepts_every_usable_format_and_names_what_is_wrong_otherwise() {
        assert!(validate_key(Provider::Anthropic, ANTHROPIC_KEY).is_ok());
        assert!(validate_key(Provider::OpenAI, PROJECT_KEY).is_ok());
        assert!(validate_key(Provider::OpenAI, "sk-svcacct-0123456789abcdef").is_ok());
        assert!(validate_key(Provider::OpenAI, "sk-0123456789abcdef0123456789").is_ok());

        // An Anthropic key would slip past a naive "starts with sk-" check.
        let err = validate_key(Provider::OpenAI, ANTHROPIC_KEY).unwrap_err();
        assert!(err.contains("Anthropic box"), "{err}");

        // Admin keys are well formed but can never generate a summary.
        let err = validate_key(Provider::OpenAI, "sk-admin-0123456789abcdef012").unwrap_err();
        assert!(err.contains("Admin keys"), "{err}");

        assert!(validate_key(Provider::Anthropic, PROJECT_KEY).is_err());
        assert!(validate_key(Provider::OpenAI, "not-a-key-at-all-really").is_err());
        assert!(validate_key(Provider::Anthropic, ANTHROPIC_PREFIX).is_err());
    }

    #[test]
    fn provider_uses_the_lowercase_names_the_front_end_sends() {
        assert_eq!(
            serde_json::to_string(&Provider::OpenAI).unwrap(),
            "\"openai\""
        );
        assert_eq!(
            serde_json::from_str::<Provider>("\"anthropic\"").unwrap(),
            Provider::Anthropic
        );
        assert!(serde_json::from_str::<Provider>("\"gemini\"").is_err());
    }
}
