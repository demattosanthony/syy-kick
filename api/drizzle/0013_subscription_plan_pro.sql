UPDATE users 
SET subscription_plan = 'pro' 
WHERE subscription_plan = 'basic';

UPDATE users
SET subscription_plan = 'free'
WHERE subscription_plan IS NULL;