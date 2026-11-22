# Account and mobile regression checks

Run from the repository root:

```sh
npm ci
npm run test:backend
npm run test:frontend
npm test --workspace contract
npm run build
```

## Account loading

- A successful profile lookup restores the saved TaskStaker username.
- Only `404` with `PROFILE_NOT_FOUND` opens username setup.
- Database failures return `503 PROFILE_UNAVAILABLE`, not a missing-account response.
- Network errors, cold starts and expired sessions retry, then show recovery controls.
- Repeated registration returns the existing profile without changing its username.
- Changing accounts cancels the old profile request and resets account-owned state.
- A new account can continue without installing MetaMask. Validators do not need a wallet.

## Independent review

- An owner cannot pick their own username or numeric ID as validator.
- Both create-task and assign-validator APIs reject self-assignment.
- Validation rejects the task owner, including old self-assigned records and direct API requests.
- Task feeds do not give owners validator controls on old self-assigned records.
- A distinct assigned account can review and validate without a wallet.
- The UI asks owners to choose someone they know and trust. Account separation does not prove that two accounts belong to different humans or establish a personal relationship.
- Existing completed blockchain records are not rewritten by these changes.

## Mobile manual checks

Check at 320, 390, 768 and 1440 CSS pixels:

- Header buttons remain visible with a long username.
- Mobile activity and new-task views switch without losing form state.
- Bottom navigation leaves space to reach the last action on a page.
- Verify does not scroll the task form sideways or cut off field labels.
- Notification popup and wallet drawer fit the viewport.
- Inputs remain readable and do not trigger small-text zoom on iOS.
- A server outage never becomes a prompt to choose another username.
- An on-chain task is not marked confirmed solely because a timer elapsed.

Use clearly labeled test accounts and Sepolia test ETH for demonstrations. Keep owner and validator sessions separate. Never present one person operating two demo accounts as actual independent human validation.
