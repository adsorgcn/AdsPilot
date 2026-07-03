{
  description = "Development environment for Google-Monetize SaaS";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config = { allowUnfree = true; };
        };
        devcfg = import ./.idx/dev.nix { inherit pkgs; };
      in
      {
        # 默认开发环境：在 .idx/dev.nix 的基础上覆盖 Go 版本为 1.25
        devShells.default = pkgs.mkShell {
          buildInputs = [ pkgs.go_1_25 ] ++ devcfg.packages;
        };

        # 备选：只包含 Go 1.25 与常用 CLI 的精简环境
        devShells.go125 = pkgs.mkShell {
          buildInputs = [
            pkgs.go_1_25
            pkgs.nodejs_20
            pkgs.pnpm
            (pkgs.google-cloud-sdk.withExtraComponents [
              pkgs.google-cloud-sdk.components.gsutil
              pkgs.google-cloud-sdk.components.gke-gcloud-auth-plugin
              pkgs.google-cloud-sdk.components.cloud_sql_proxy
            ])
          ];
        };
      });
}
