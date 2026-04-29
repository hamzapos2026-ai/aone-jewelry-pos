# Firebase Security Rules Fix - Cashier Payment Update

## Problem
Cashier role was getting: `FirebaseError: Missing or insufficient permissions` when trying to mark orders as paid.

## Solution
Updated Firestore security rules to allow cashiers to update orders when processing payments.

## How to Deploy

### Option 1: Firebase Console (Easiest)
1. Go to https://console.firebase.google.com
2. Select your project → **Firestore Database**
3. Click on **Rules** tab at the top
4. Replace all content with the rules from `firestore.rules` file
5. Click **Publish** button
6. Wait for deployment (usually takes 1-2 minutes)

### Option 2: Firebase CLI
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Login: `firebase login`
3. Deploy rules: `firebase deploy --only firestore:rules`
4. Confirm by pressing 'y'

## What Changed
- ✅ Cashiers (`cashier` role) can now **mark orders as paid** (status → 'paid')
- ✅ Cashiers can now **cancel orders** (status → 'cancelled')
- ✅ Billers can still edit their own orders before payment
- ✅ Admins/Managers have full permissions
- ✅ All roles still have read access to orders

## User Roles Defined
- **superadmin**: Full access to everything
- **admin**: System admin, can manage rules and settings
- **manager**: Can view reports, audit logs, and cashier actions
- **biller**: Can create and edit their own orders
- **cashier**: Can process payments and view pending orders

## Files Modified
- `firestore.rules` - Created with complete security rule set
