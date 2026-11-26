package com.nca.sistema_miiase_app.domain.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import com.nca.sistema_miiase_app.domain.entity.SubmissaoArtigo;

public interface SubmissaoArtigoRepository extends JpaRepository<SubmissaoArtigo, Integer>, JpaSpecificationExecutor<SubmissaoArtigo> {
    Optional<SubmissaoArtigo> findByIdAndUsuarioId(Integer id, Integer usuarioId);
}
