#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Address};
use soroban_sdk::testutils::Address as _;

#[test]
fn test_rewards_badge_simple() {
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register_contract(None, RewardsBadgeContract);
    let client = RewardsBadgeContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let donor = Address::generate(&env);

    client.initialize(&admin);

    client.mint_badge(&donor, &1);

    assert_eq!(client.get_badge_tier(&donor), 1);
}
