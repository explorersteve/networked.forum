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

        <a
          href="https://discord.gg/qqTeUsSqAG"
          class="header-button header-button--icon"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Discord"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 127.14 96.36"
            width="18"
            height="14"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M107.7,8.07A105.15,105.15,0,0,0,81.47,0a72.06,72.06,0,0,0-3.36,6.83A97.68,97.68,0,0,0,49,6.83,72.37,72.37,0,0,0,45.64,0,105.89,105.89,0,0,0,19.39,8.09C2.79,32.65-1.71,56.6.54,80.21A105.73,105.73,0,0,0,32.71,96.36,77.7,77.7,0,0,0,39.6,85.25a68.42,68.42,0,0,1-10.85-5.18c.91-.66,1.8-1.34,2.66-2a75.57,75.57,0,0,0,64.32,0c.87.71,1.76,1.39,2.66,2a68.68,68.68,0,0,1-10.87,5.19,77,77,0,0,0,6.89,11.1A105.25,105.25,0,0,0,126.6,80.22C129.24,52.84,122.09,29.11,107.7,8.07ZM42.45,65.69C36.18,65.69,31,60,31,53s5-12.74,11.43-12.74S54,46,53.89,53,48.84,65.69,42.45,65.69Zm42.24,0C78.41,65.69,73.25,60,73.25,53s5-12.74,11.47-12.74S96.66,46,96.54,53,91.37,65.69,84.69,65.69Z"
            />
          </svg>
        </a>
      </div>
    </div>

    <h1 class="app-header__title">
      An On-Chain Art Forum
    </h1>
  </header>
</template>
