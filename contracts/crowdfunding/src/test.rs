#![cfg(test)]
use super::*;
use soroban_sdk::{Env, Address, Symbol, token, IntoVal, String};
use soroban_sdk::testutils::Address as _;
use rewards_badge::RewardsBadgeContract;

#[test]
fn test_escrow_milestone_flow() {
    let env = Env::default();
    env.mock_all_auths();

    // 1. Register Contracts
    let token_admin = Address::generate(&env);
    let token_contract_id = env.register_stellar_asset_contract(token_admin);
    let token_client = token::Client::new(&env, &token_contract_id);
    let token_admin_client = token::StellarAssetClient::new(&env, &token_contract_id);

    let badge_contract_id = env.register_contract(None, RewardsBadgeContract);
    let crowdfunding_contract_id = env.register_contract(None, CrowdfundingContract);
    let crowdfunding_client = CrowdfundingContractClient::new(&env, &crowdfunding_contract_id);

    let _: () = env.invoke_contract(
        &badge_contract_id,
        &Symbol::new(&env, "initialize"),
        soroban_sdk::vec![&env, crowdfunding_contract_id.clone().into_val(&env)]
    );

    let _: () = env.invoke_contract(
        &badge_contract_id,
        &Symbol::new(&env, "set_minter"),
        soroban_sdk::vec![&env, crowdfunding_contract_id.clone().into_val(&env)]
    );



    let campaign_owner = Address::generate(&env);
    let goal_amount = 1000 * 10_000_000i128; // 1000 XLM
    crowdfunding_client.initialize(&campaign_owner, &goal_amount, &token_contract_id, &badge_contract_id);

    let donor1 = Address::generate(&env);
    token_admin_client.mint(&donor1, &(500 * 10_000_000i128));

    let donor2 = Address::generate(&env);
    token_admin_client.mint(&donor2, &(500 * 10_000_000i128));

    // Test 1: Donate holds funds in escrow
    let donate_amount_1 = 300 * 10_000_000i128; // 30% of goal, reaches milestone 1 (25%)
    crowdfunding_client.donate(&donor1, &donate_amount_1);

    assert_eq!(token_client.balance(&campaign_owner), 0); // owner gets nothing yet
    assert_eq!(token_client.balance(&crowdfunding_contract_id), donate_amount_1); // contract holds funds
    
    // Check milestone 1 status
    let ms1 = crowdfunding_client.get_milestone_status(&1);
    assert!(ms1.status == MilestoneStatus::Reached);

    // Test 2: Submit Proof
    let proof_hash = String::from_str(&env, "ipfs://QmProof123");
    crowdfunding_client.submit_milestone_proof(&1, &proof_hash);
    let ms1_post_proof = crowdfunding_client.get_milestone_status(&1);
    assert!(ms1_post_proof.status == MilestoneStatus::ProofSubmitted);
    assert_eq!(ms1_post_proof.proof_hash, proof_hash);

    // Test 3: Vote (Approve)
    crowdfunding_client.vote_on_milestone(&donor1, &1, &true);
    let ms1_post_vote = crowdfunding_client.get_milestone_status(&1);
    assert_eq!(ms1_post_vote.approve_votes, donate_amount_1);
    assert_eq!(ms1_post_vote.reject_votes, 0);

    // Test 4: Release Funds
    crowdfunding_client.release_milestone_funds(&1);
    let ms1_released = crowdfunding_client.get_milestone_status(&1);
    assert!(ms1_released.status == MilestoneStatus::Released);
    
    let expected_release = 250 * 10_000_000i128; // 25% of 1000 XLM
    assert_eq!(token_client.balance(&campaign_owner), expected_release);
    assert_eq!(token_client.balance(&crowdfunding_contract_id), donate_amount_1 - expected_release);

    // Test 5: Reject milestone 2 (reached at 500 XLM, total will be 550)
    let donate_amount_2 = 250 * 10_000_000i128; 
    crowdfunding_client.donate(&donor2, &donate_amount_2);
    
    let ms2 = crowdfunding_client.get_milestone_status(&2);
    assert!(ms2.status == MilestoneStatus::Reached);

    crowdfunding_client.submit_milestone_proof(&2, &String::from_str(&env, "ipfs://badproof"));
    
    // Both donors reject
    crowdfunding_client.vote_on_milestone(&donor2, &2, &false);
    crowdfunding_client.vote_on_milestone(&donor1, &2, &false);
    
    crowdfunding_client.release_milestone_funds(&2);
    
    let ms2_rejected = crowdfunding_client.get_milestone_status(&2);
    assert!(ms2_rejected.status == MilestoneStatus::Rejected);

    // Test 6: Refund
    let d1_bal_before = token_client.balance(&donor1);
    crowdfunding_client.refund(&donor1, &2);
    let expected_refund = 300 * 10_000_000i128 * 25 / 100;
    assert_eq!(token_client.balance(&donor1), d1_bal_before + expected_refund);
}
// Unit tests for milestone validation flows
