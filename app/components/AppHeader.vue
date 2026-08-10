<template>
  <header class="app-header">
    <div class="app-header__inner">
      <NuxtLink
        to="/"
        class="app-brand"
        aria-label="Forum"
      >
        <img
          src="/black-squares-f.svg"
          alt=""
          class="app-brand__f"
          width="22"
          height="28"
        >
      </NuxtLink>

      <div class="app-header__actions">
        <NuxtLink
          to="/post"
          class="header-button"
        >
          Post
        </NuxtLink>

        <ClientOnly>
          <EvmConnectDialog class-name="wallet-button">
            <template #default>
              Connect
            </template>

            <template #connected="{ address }">
              <EvmProfile class-name="wallet-button">
                <EvmAccount
                  :address="address"
                  resolve-ens
                />
              </EvmProfile>
            </template>
          </EvmConnectDialog>
        </ClientOnly>
      </div>
    </div>

    <h1 class="app-header__title">
      <span class="app-header__title-lead">The Unofficial On-chain Forum for </span>
      <span class="app-header__title-mark">Networked.art</span>
    </h1>
  </header>
</template>
