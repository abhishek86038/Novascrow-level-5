#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol, String};

#[derive(Clone, PartialEq, Eq)]
#[contracttype]
pub enum MilestoneStatus {
    Locked,
    Reached,
    ProofSubmitted,
    Released,
    Rejected,
}

#[contracttype]
#[derive(Clone)]
pub struct Milestone {
    pub status: MilestoneStatus,
    pub proof_hash: String,
    pub approve_votes: i128,
    pub reject_votes: i128,
}

#[contracttype]
#[derive(Clone)]
enum DataKey {
    Owner,
    Goal,
    TotalRaised,
    Token,
    BadgeContract,
    DonorAmount(Address),
    MilestoneData(u32),
    DonorVote(Address, u32),
    RefundClaimed(Address, u32),
}

#[contract]
pub struct CrowdfundingContract;

#[contractimpl]
impl CrowdfundingContract {
    pub fn initialize(
        env: Env,
        campaign_owner: Address,
        goal_amount: i128,
        token: Address,
        badge_contract: Address,
    ) {
        if env.storage().instance().has(&DataKey::Owner) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Owner, &campaign_owner);
        env.storage().instance().set(&DataKey::Goal, &goal_amount);
        env.storage().instance().set(&DataKey::TotalRaised, &0i128);
        env.storage().instance().set(&DataKey::Token, &token);
        env.storage().instance().set(&DataKey::BadgeContract, &badge_contract);

        for i in 1..=4 {
            env.storage().instance().set(&DataKey::MilestoneData(i), &Milestone {
                status: MilestoneStatus::Locked,
                proof_hash: String::from_str(&env, ""),
                approve_votes: 0,
                reject_votes: 0,
            });
        }
    }

    pub fn donate(env: Env, donor: Address, amount: i128) {
        if amount <= 0 {
            panic!("Amount must be greater than zero");
        }
        donor.require_auth();

        let token_address: Address = env.storage().instance().get(&DataKey::Token).expect("Not initialized");

        // Transfer tokens from donor to contract (escrow)
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);
        token_client.transfer(&donor, &env.current_contract_address(), &amount);

        // Update total raised
        let mut total = env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0i128);
        total += amount;
        env.storage().instance().set(&DataKey::TotalRaised, &total);

        // Update donor's cumulative total
        let mut donor_total = env.storage().persistent().get(&DataKey::DonorAmount(donor.clone())).unwrap_or(0i128);
        donor_total += amount;
        env.storage().persistent().set(&DataKey::DonorAmount(donor.clone()), &donor_total);

        // Check milestone thresholds
        let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
        for i in 1..=4 {
            let threshold = goal * (i as i128) * 25 / 100;
            if total >= threshold {
                let mut ms: Milestone = env.storage().instance().get(&DataKey::MilestoneData(i)).unwrap();
                if ms.status == MilestoneStatus::Locked {
                    ms.status = MilestoneStatus::Reached;
                    env.storage().instance().set(&DataKey::MilestoneData(i), &ms);
                    env.events().publish((Symbol::new(&env, "milestone_reached"), i), threshold);
                }
            }
        }

        // Check badge threshold (XLM 7 decimals)
        let decimals = 10_000_000i128;
        let bronze_threshold = 50 * decimals;
        let silver_threshold = 200 * decimals;
        let gold_threshold = 500 * decimals;

        let mut tier = 0;
        if donor_total >= gold_threshold {
            tier = 3;
        } else if donor_total >= silver_threshold {
            tier = 2;
        } else if donor_total >= bronze_threshold {
            tier = 1;
        }

        if tier > 0 {
            let badge_contract: Address = env.storage().instance().get(&DataKey::BadgeContract).expect("Badge contract not set");
            use soroban_sdk::IntoVal;
            let current_tier: u32 = env.invoke_contract(
                &badge_contract,
                &Symbol::new(&env, "get_badge_tier"),
                soroban_sdk::vec![&env, donor.clone().into_val(&env)]
            );

            if tier > current_tier {
                // Authorize the crowdfunding contract itself to call mint_badge
                env.authorize_as_current_contract(soroban_sdk::vec![
                    &env,
                    soroban_sdk::auth::InvokerContractAuthEntry::Contract(
                        soroban_sdk::auth::SubContractInvocation {
                            context: soroban_sdk::auth::ContractContext {
                                contract: badge_contract.clone(),
                                fn_name: Symbol::new(&env, "mint_badge"),
                                args: (donor.clone(), tier).into_val(&env),
                            },
                            sub_invocations: soroban_sdk::vec![&env],
                        }
                    )
                ]);

                let _: () = env.invoke_contract(
                    &badge_contract,
                    &Symbol::new(&env, "mint_badge"),
                    soroban_sdk::vec![&env, donor.clone().into_val(&env), tier.into_val(&env)]
                );
            }
        }

        env.events().publish(
            (Symbol::new(&env, "donation_received"), donor.clone()),
            (amount, total)
        );
    }

    pub fn submit_milestone_proof(env: Env, milestone_id: u32, proof_hash: String) {
        let owner: Address = env.storage().instance().get(&DataKey::Owner).expect("Not initialized");
        owner.require_auth();

        if milestone_id < 1 || milestone_id > 4 {
            panic!("Invalid milestone ID");
        }

        let mut ms: Milestone = env.storage().instance().get(&DataKey::MilestoneData(milestone_id)).unwrap();
        if ms.status != MilestoneStatus::Reached {
            panic!("Milestone not reached or already processed");
        }

        ms.status = MilestoneStatus::ProofSubmitted;
        ms.proof_hash = proof_hash.clone();
        env.storage().instance().set(&DataKey::MilestoneData(milestone_id), &ms);

        env.events().publish((Symbol::new(&env, "proof_submitted"), milestone_id), proof_hash);
    }

    pub fn vote_on_milestone(env: Env, donor: Address, milestone_id: u32, approve: bool) {
        donor.require_auth();

        let donor_amount = env.storage().persistent().get(&DataKey::DonorAmount(donor.clone())).unwrap_or(0i128);
        if donor_amount <= 0 {
            panic!("Only donors can vote");
        }

        if env.storage().persistent().has(&DataKey::DonorVote(donor.clone(), milestone_id)) {
            panic!("Already voted on this milestone");
        }

        let mut ms: Milestone = env.storage().instance().get(&DataKey::MilestoneData(milestone_id)).unwrap();
        if ms.status != MilestoneStatus::ProofSubmitted {
            panic!("Milestone not in voting state");
        }

        if approve {
            ms.approve_votes += donor_amount;
        } else {
            ms.reject_votes += donor_amount;
        }

        env.storage().persistent().set(&DataKey::DonorVote(donor.clone(), milestone_id), &true);
        env.storage().instance().set(&DataKey::MilestoneData(milestone_id), &ms);

        env.events().publish((Symbol::new(&env, "vote_cast"), milestone_id, donor.clone()), approve);
    }

    pub fn release_milestone_funds(env: Env, milestone_id: u32) {
        let mut ms: Milestone = env.storage().instance().get(&DataKey::MilestoneData(milestone_id)).unwrap();
        if ms.status != MilestoneStatus::ProofSubmitted {
            panic!("Milestone not in voting state");
        }

        let total_votes = ms.approve_votes + ms.reject_votes;
        if total_votes == 0 {
            panic!("No votes cast yet");
        }

        if ms.approve_votes > ms.reject_votes {
            ms.status = MilestoneStatus::Released;
            env.storage().instance().set(&DataKey::MilestoneData(milestone_id), &ms);

            let goal: i128 = env.storage().instance().get(&DataKey::Goal).unwrap();
            let amount_to_release = goal * 25 / 100;

            let token_address: Address = env.storage().instance().get(&DataKey::Token).unwrap();
            let owner: Address = env.storage().instance().get(&DataKey::Owner).unwrap();
            let token_client = soroban_sdk::token::Client::new(&env, &token_address);
            
            let balance = token_client.balance(&env.current_contract_address());
            let actual_release = if balance < amount_to_release { balance } else { amount_to_release };
            
            if actual_release > 0 {
                token_client.transfer(&env.current_contract_address(), &owner, &actual_release);
            }

            env.events().publish((Symbol::new(&env, "funds_released"), milestone_id), actual_release);
        } else {
            ms.status = MilestoneStatus::Rejected;
            env.storage().instance().set(&DataKey::MilestoneData(milestone_id), &ms);
            env.events().publish((Symbol::new(&env, "milestone_rejected"), milestone_id), ());
        }
    }

    pub fn refund(env: Env, donor: Address, milestone_id: u32) {
        donor.require_auth();

        let ms: Milestone = env.storage().instance().get(&DataKey::MilestoneData(milestone_id)).unwrap();
        if ms.status != MilestoneStatus::Rejected {
            panic!("Milestone not rejected");
        }

        if env.storage().persistent().has(&DataKey::RefundClaimed(donor.clone(), milestone_id)) {
            panic!("Refund already claimed");
        }

        let donor_amount = env.storage().persistent().get(&DataKey::DonorAmount(donor.clone())).unwrap_or(0i128);
        if donor_amount <= 0 {
            panic!("Not a donor");
        }

        let refund_amount = donor_amount * 25 / 100;

        let token_address: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = soroban_sdk::token::Client::new(&env, &token_address);

        let balance = token_client.balance(&env.current_contract_address());
        let actual_refund = if balance < refund_amount { balance } else { refund_amount };

        if actual_refund > 0 {
            token_client.transfer(&env.current_contract_address(), &donor, &actual_refund);
        }

        env.storage().persistent().set(&DataKey::RefundClaimed(donor.clone(), milestone_id), &true);
        env.events().publish((Symbol::new(&env, "refund_issued"), milestone_id, donor), actual_refund);
    }

    pub fn get_milestone_status(env: Env, milestone_id: u32) -> Milestone {
        env.storage().instance().get(&DataKey::MilestoneData(milestone_id)).expect("Invalid milestone")
    }

    pub fn get_total_raised(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::TotalRaised).unwrap_or(0i128)
    }

    pub fn get_goal(env: Env) -> i128 {
        env.storage().instance().get(&DataKey::Goal).unwrap_or(0i128)
    }
}

#[cfg(test)]
mod test;
// Crowdfunding core contract
